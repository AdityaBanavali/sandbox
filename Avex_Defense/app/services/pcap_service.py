# pyright: reportAttributeAccessIssue=none
"""
Raw byte-level PCAP parser and Unidirectional Flow Aggregator powered by dpkt.
Bypasses slow subprocesses (tshark/pyshark) for line-rate packet analysis.
"""

import io
import logging
import socket
from typing import Any, BinaryIO, Dict, Iterator, List, Optional, Tuple, Union
import dpkt

from app.services.packet_extractor import (
    PacketRecord,
    UnidirectionalFlowWindow,
    EWMATracker,
)

logger = logging.getLogger(__name__)


def parse_ip_address(addr_bytes: bytes, family: int = socket.AF_INET) -> str:
    """
    Safely converts raw IP address bytes to string notation.
    """
    try:
        return socket.inet_ntop(family, addr_bytes)
    except Exception:
        return socket.inet_ntoa(addr_bytes) if family == socket.AF_INET else "unknown"


def extract_tcp_flags(flags: int) -> Dict[str, bool]:
    """
    Decodes TCP header flag bitmask into a boolean dictionary.
    """
    return {
        "SYN": bool(flags & dpkt.tcp.TH_SYN),
        "ACK": bool(flags & dpkt.tcp.TH_ACK),
        "FIN": bool(flags & dpkt.tcp.TH_FIN),
        "RST": bool(flags & dpkt.tcp.TH_RST),
        "PSH": bool(flags & dpkt.tcp.TH_PUSH),
        "URG": bool(flags & dpkt.tcp.TH_URG),
        "ECE": bool(flags & dpkt.tcp.TH_ECE),
        "CWR": bool(flags & dpkt.tcp.TH_CWR),
    }


def iter_pcap_packets(pcap_source: Union[bytes, BinaryIO]) -> Iterator[PacketRecord]:
    """
    Iterates over a PCAP byte stream or file object using dpkt.
    Parses Ethernet, SLL (Linux cooked), IPv4, IPv6, TCP, UDP, and ICMP at raw byte level.
    """
    if isinstance(pcap_source, bytes):
        stream = io.BytesIO(pcap_source)
    else:
        stream = pcap_source

    try:
        pcap_reader = dpkt.pcap.Reader(stream)
    except Exception as exc:
        # Check if PCAP-NG or invalid
        logger.error("Failed to initialize dpkt.pcap.Reader: %s", exc)
        raise ValueError(f"Invalid PCAP stream: {exc}") from exc

    dloff = pcap_reader.datalink()

    for ts, raw_buf in pcap_reader:
        try:
            # ---------------------------------------------------------------
            # 1. Datalink Layer Parsing
            # ---------------------------------------------------------------
            if dloff == dpkt.pcap.DLT_EN10MB:
                eth = dpkt.ethernet.Ethernet(raw_buf)
                ip_pkt = eth.data
            elif dloff == dpkt.pcap.DLT_LINUX_SLL:
                sll = dpkt.sll.SLL(raw_buf)
                ip_pkt = sll.data
            elif dloff == dpkt.pcap.DLT_RAW:
                # Direct IP packet
                ip_pkt = dpkt.ip.IP(raw_buf)
            else:
                # Attempt Ethernet fallback
                eth = dpkt.ethernet.Ethernet(raw_buf)
                ip_pkt = eth.data

            # ---------------------------------------------------------------
            # 2. Network Layer (IPv4 or IPv6)
            # ---------------------------------------------------------------
            if isinstance(ip_pkt, dpkt.ip.IP):
                src_ip = parse_ip_address(ip_pkt.src, socket.AF_INET)
                dst_ip = parse_ip_address(ip_pkt.dst, socket.AF_INET)
                ip_ttl = ip_pkt.ttl
                proto_num = ip_pkt.p
                l4_pkt = ip_pkt.data
            elif isinstance(ip_pkt, dpkt.ip6.IP6):
                src_ip = parse_ip_address(ip_pkt.src, socket.AF_INET6)
                dst_ip = parse_ip_address(ip_pkt.dst, socket.AF_INET6)
                ip_ttl = ip_pkt.hlim
                proto_num = ip_pkt.nxt
                l4_pkt = ip_pkt.data
            else:
                # Non-IP packet (e.g. ARP, STP) - skip in IP threat analyzer
                continue

            # ---------------------------------------------------------------
            # 3. Transport Layer (TCP, UDP, ICMP)
            # ---------------------------------------------------------------
            src_port = 0
            dst_port = 0
            protocol_name = "OTHER"
            tcp_flags: Dict[str, bool] = {}
            payload_bytes = b""

            if isinstance(l4_pkt, dpkt.tcp.TCP) or proto_num == dpkt.ip.IP_PROTO_TCP:
                if not isinstance(l4_pkt, dpkt.tcp.TCP):
                    l4_pkt = dpkt.tcp.TCP(bytes(l4_pkt))
                protocol_name = "TCP"
                src_port = l4_pkt.sport
                dst_port = l4_pkt.dport
                tcp_flags = extract_tcp_flags(l4_pkt.flags)
                payload_bytes = l4_pkt.data if isinstance(l4_pkt.data, bytes) else (bytes(l4_pkt.data) if l4_pkt.data else b"")

            elif isinstance(l4_pkt, dpkt.udp.UDP) or proto_num == dpkt.ip.IP_PROTO_UDP:
                if not isinstance(l4_pkt, dpkt.udp.UDP):
                    l4_pkt = dpkt.udp.UDP(bytes(l4_pkt))
                protocol_name = "UDP"
                src_port = l4_pkt.sport
                dst_port = l4_pkt.dport
                payload_bytes = l4_pkt.data if isinstance(l4_pkt.data, bytes) else (bytes(l4_pkt.data) if l4_pkt.data else b"")

            elif isinstance(l4_pkt, dpkt.icmp.ICMP) or proto_num == dpkt.ip.IP_PROTO_ICMP:
                if not isinstance(l4_pkt, dpkt.icmp.ICMP):
                    l4_pkt = dpkt.icmp.ICMP(bytes(l4_pkt))
                protocol_name = "ICMP"
                src_port = 0
                dst_port = int(l4_pkt.type)
                payload_bytes = l4_pkt.data if isinstance(l4_pkt.data, bytes) else (bytes(l4_pkt.data) if l4_pkt.data else b"")

            yield PacketRecord(
                timestamp=float(ts),
                src_ip=src_ip,
                dst_ip=dst_ip,
                src_port=src_port,
                dst_port=dst_port,
                protocol=protocol_name,
                packet_size=len(raw_buf),
                ip_ttl=ip_ttl,
                tcp_flags=tcp_flags,
                payload_bytes=payload_bytes,
            )

        except Exception as exc:
            # Skip malformed packets and continue stream
            logger.debug("Skipping malformed packet: %s", exc)
            continue


class UnidirectionalFlowAggregator:
    """
    Maintains sliding state for unidirectional IP flows.
    Assembles packets into flow windows and emits finalized feature dictionaries
    when a window reaches max packets or inactivity timeout.
    """

    def __init__(
        self,
        inactivity_timeout_s: float = 10.0,
        max_packets_per_window: int = 500,
    ):
        self.inactivity_timeout_s = inactivity_timeout_s
        self.max_packets_per_window = max_packets_per_window
        self.flows: Dict[Tuple[str, str, int, int, str], UnidirectionalFlowWindow] = {}
        self.global_ewma = EWMATracker(alpha=0.1)

    def process_packet(self, pkt: PacketRecord) -> List[Dict[str, Any]]:
        """
        Ingests a single packet.
        If a flow window exceeds limits or inactive flows are detected,
        flushes and returns finalized flow feature dictionaries.
        """
        key = (pkt.src_ip, pkt.dst_ip, pkt.src_port, pkt.dst_port, pkt.protocol)
        finalized_flows: List[Dict[str, Any]] = []

        # Check existing flow
        flow_window = self.flows.get(key)

        if flow_window is not None:
            # Check if flow exceeded inactivity timeout
            if (pkt.timestamp - flow_window.last_time) > self.inactivity_timeout_s:
                finalized_flows.append(flow_window.extract_features())
                # Reinitialize flow window
                flow_window = UnidirectionalFlowWindow(
                    src_ip=pkt.src_ip,
                    dst_ip=pkt.dst_ip,
                    src_port=pkt.src_port,
                    dst_port=pkt.dst_port,
                    protocol=pkt.protocol,
                    ewma_tracker=self.global_ewma,
                )
                self.flows[key] = flow_window
        else:
            flow_window = UnidirectionalFlowWindow(
                src_ip=pkt.src_ip,
                dst_ip=pkt.dst_ip,
                src_port=pkt.src_port,
                dst_port=pkt.dst_port,
                protocol=pkt.protocol,
                ewma_tracker=self.global_ewma,
            )
            self.flows[key] = flow_window

        flow_window.add_packet(pkt)

        # Check max packet limit per window
        if flow_window.packet_count >= self.max_packets_per_window:
            finalized_flows.append(flow_window.extract_features())
            del self.flows[key]

        return finalized_flows

    def flush_all(self) -> List[Dict[str, Any]]:
        """
        Flushes all active flow windows and extracts their final feature sets.
        """
        results = [flow.extract_features() for flow in self.flows.values()]
        self.flows.clear()
        return results

    def process_pcap(self, pcap_source: Union[bytes, BinaryIO]) -> List[Dict[str, Any]]:
        """
        Parses an entire PCAP source and extracts all finalized unidirectional flow features.
        """
        finalized: List[Dict[str, Any]] = []
        for pkt in iter_pcap_packets(pcap_source):
            flushed = self.process_packet(pkt)
            if flushed:
                finalized.extend(flushed)

        finalized.extend(self.flush_all())
        return finalized
