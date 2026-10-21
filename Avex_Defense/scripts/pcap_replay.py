#!/usr/bin/env python3
# pyright: reportAttributeAccessIssue=none
"""
Synthetic PCAP Generator and Asyncio Controlled-Rate Replay Script.
Simulates unidirectional traffic for data diode threat detection:
1. Benign background traffic (varying packet sizes & IATs, modest entropy).
2. C2 Periodic Beaconing (rigid ~1.0s IAT, low IAT entropy).
3. Covert High-Entropy Data Exfiltration (encrypted bytes, entropy > 7.5).
4. Unidirectional Port Scan / Sweep (low packet count, sequential target ports).
5. TTL / OS Spoofing (varying initial TTLs from same IP address).

Supports controlled replay rates via asyncio (pps or time-multiplier).
"""

import argparse
import asyncio
import io
import math
import os
import random
import socket
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
import dpkt
import httpx

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.packet_extractor import (
    calculate_shannon_entropy,
    calculate_iat_shannon_entropy,
)
from app.services.pcap_service import UnidirectionalFlowAggregator, iter_pcap_packets


def build_raw_ethernet_ip_packet(
    src_ip: str,
    dst_ip: str,
    src_port: int,
    dst_port: int,
    protocol: str,
    payload: bytes,
    ttl: int = 64,
    tcp_flags: int = dpkt.tcp.TH_ACK,
) -> bytes:
    """
    Constructs a raw Ethernet + IPv4 + TCP/UDP/ICMP frame using dpkt.
    """
    # L4
    if protocol.upper() == "TCP":
        l4 = dpkt.tcp.TCP(
            sport=src_port,
            dport=dst_port,
            flags=tcp_flags,
            seq=random.randint(1000, 999999),
            ack=random.randint(1000, 999999),
            win=65535,
            data=payload,
        )
        proto_num = dpkt.ip.IP_PROTO_TCP
    elif protocol.upper() == "UDP":
        l4 = dpkt.udp.UDP(
            sport=src_port,
            dport=dst_port,
            data=payload,
        )
        l4.ulen = len(l4)
        proto_num = dpkt.ip.IP_PROTO_UDP
    else:
        l4 = dpkt.icmp.ICMP(
            type=8,  # Echo request
            code=0,
            data=dpkt.icmp.ICMP.Echo(id=1, seq=1, data=payload),
        )
        proto_num = dpkt.ip.IP_PROTO_ICMP

    # L3 (IPv4)
    ip = dpkt.ip.IP(
        src=socket.inet_aton(src_ip),
        dst=socket.inet_aton(dst_ip),
        p=proto_num,
        ttl=ttl,
        data=l4,
    )
    ip.len = len(ip)

    # L2 (Ethernet)
    eth = dpkt.ethernet.Ethernet(
        src=b"\x00\x0c\x29\x4f\x8e\x35",
        dst=b"\x00\x50\x56\xe8\x00\x01",
        type=dpkt.ethernet.ETH_TYPE_IP,
        data=ip,
    )
    return bytes(eth)


def generate_synthetic_threat_pcap() -> bytes:
    """
    Generates an in-memory PCAP byte stream containing all 5 behavioral scenarios.
    """
    buffer = io.BytesIO()
    writer = dpkt.pcap.Writer(buffer)

    curr_time = time.time() - 300.0  # Start 5 minutes in the past

    # -----------------------------------------------------------------------
    # Scenario 1: Benign Unidirectional Background Traffic
    # Mixed packet sizes (64 to 1200), varied IAT (10ms to 400ms), modest entropy
    # -----------------------------------------------------------------------
    src_benign = "192.168.10.100"
    dst_benign = "10.0.0.53"
    for i in range(40):
        iat = random.uniform(0.01, 0.35)
        curr_time += iat
        # Normal text/DNS-like payload
        payload = f"BENIGN_DNS_QUERY_{i}_example.internal.network.local".encode("utf-8")
        raw = build_raw_ethernet_ip_packet(
            src_ip=src_benign,
            dst_ip=dst_benign,
            src_port=52000 + (i % 10),
            dst_port=53,
            protocol="UDP",
            payload=payload,
            ttl=64,
        )
        writer.writepkt(raw, ts=curr_time)

    # -----------------------------------------------------------------------
    # Scenario 2: C2 Beaconing Channel (e.g. Cobalt Strike / Sliver)
    # Strictly periodic intervals: 1.0s ± 2ms jitter. Low IAT entropy!
    # -----------------------------------------------------------------------
    src_c2 = "192.168.10.205"
    dst_c2 = "198.51.100.4"
    c2_port = 8443
    for i in range(25):
        # Extremely low timing jitter: 1.000s +- 0.003s
        iat = 1.0 + random.uniform(-0.003, 0.003)
        curr_time += iat
        beacon_payload = f"C2_HEARTBEAT_PULSE_SEQ_{i}".encode("utf-8")
        raw = build_raw_ethernet_ip_packet(
            src_ip=src_c2,
            dst_ip=dst_c2,
            src_port=49800,
            dst_port=c2_port,
            protocol="TCP",
            payload=beacon_payload,
            ttl=128,  # Windows host
            tcp_flags=dpkt.tcp.TH_PUSH | dpkt.tcp.TH_ACK,
        )
        writer.writepkt(raw, ts=curr_time)

    # -----------------------------------------------------------------------
    # Scenario 3: High-Entropy Data Exfiltration (Covert Diode Tunnel)
    # Random cryptographic bytes (entropy > 7.7), large 1350-byte packets, rapid stream
    # -----------------------------------------------------------------------
    src_exfil = "192.168.10.18"
    dst_exfil = "203.0.113.88"
    for i in range(35):
        iat = random.uniform(0.005, 0.02)
        curr_time += iat
        # Generate pseudorandom high-entropy encrypted ciphertext
        encrypted_chunk = bytes([random.randint(0, 255) for _ in range(1200)])
        raw = build_raw_ethernet_ip_packet(
            src_ip=src_exfil,
            dst_ip=dst_exfil,
            src_port=55123,
            dst_port=443,
            protocol="TCP",
            payload=encrypted_chunk,
            ttl=64,
            tcp_flags=dpkt.tcp.TH_ACK,
        )
        writer.writepkt(raw, ts=curr_time)

    # -----------------------------------------------------------------------
    # Scenario 4: Unidirectional Port Scan / Sweep (T1046)
    # Single-packet probes to sequential ports (21, 22, 23, 80, 443, 3389, 8080)
    # -----------------------------------------------------------------------
    src_scanner = "192.168.10.99"
    dst_target = "10.0.0.1"
    target_ports = [21, 22, 23, 25, 80, 110, 143, 443, 445, 3389, 8080, 8443]
    for port in target_ports:
        curr_time += 0.02
        raw = build_raw_ethernet_ip_packet(
            src_ip=src_scanner,
            dst_ip=dst_target,
            src_port=40000,
            dst_port=port,
            protocol="TCP",
            payload=b"",
            ttl=64,
            tcp_flags=dpkt.tcp.TH_SYN,  # SYN-only probe without return visibility
        )
        writer.writepkt(raw, ts=curr_time)

    # -----------------------------------------------------------------------
    # Scenario 5: TTL / Device Spoofing (Multi-Device Masquerade)
    # Single source IP alternating between TTL 64, 128, and 255
    # -----------------------------------------------------------------------
    src_spoofed = "192.168.10.77"
    dst_srv = "10.0.0.200"
    for i in range(15):
        curr_time += 0.05
        # Injected alternating TTLs
        spoofed_ttl = random.choice([64, 128, 255])
        payload = f"DEVICE_TELEMETRY_PACKET_{i}".encode("utf-8")
        raw = build_raw_ethernet_ip_packet(
            src_ip=src_spoofed,
            dst_ip=dst_srv,
            src_port=53000,
            dst_port=80,
            protocol="TCP",
            payload=payload,
            ttl=spoofed_ttl,
            tcp_flags=dpkt.tcp.TH_ACK,
        )
        writer.writepkt(raw, ts=curr_time)

    data = buffer.getvalue()
    writer.close()
    return data



async def replay_pcap_stream(
    pcap_bytes: bytes,
    rate_pps: float = 100.0,
    api_url: Optional[str] = None,
) -> None:
    """
    Replays PCAP packets at a controlled packet-per-second (pps) rate using asyncio.
    Feeds packets directly through UnidirectionalFlowAggregator and optionally POSTs to API.
    """
    delay_per_packet = 1.0 / rate_pps if rate_pps > 0 else 0.0
    aggregator = UnidirectionalFlowAggregator(inactivity_timeout_s=5.0)

    print(f"[*] Beginning PCAP replay at controlled rate: {rate_pps} pps...")
    start_wall = time.time()
    packet_count = 0

    http_client = httpx.AsyncClient(timeout=10.0) if api_url else None

    try:
        for pkt in iter_pcap_packets(pcap_bytes):
            packet_count += 1
            flushed_flows = aggregator.process_packet(pkt)

            if flushed_flows:
                print(f"[+] Window flushed {len(flushed_flows)} flows! (packets ingested: {packet_count})")
                for flow_data in flushed_flows:
                    log_flow_threat_summary(flow_data)

                    # Post to API if enabled
                    if http_client and api_url:
                        try:
                            payload = {
                                "src_ip": flow_data["src_ip"],
                                "dst_ip": flow_data["dst_ip"],
                                "src_port": flow_data["src_port"],
                                "dst_port": flow_data["dst_port"],
                                "protocol": flow_data["protocol"],
                                "start_time": flow_data["start_time"].isoformat(),
                                "end_time": flow_data["end_time"].isoformat(),
                                "duration_ms": flow_data["duration_ms"],
                                "packet_count": flow_data["packet_count"],
                                "byte_count": flow_data["byte_count"],
                                "packet_size_mean": flow_data["packet_size_mean"],
                                "packet_size_std": flow_data["packet_size_std"],
                                "packet_size_min": flow_data["packet_size_min"],
                                "packet_size_max": flow_data["packet_size_max"],
                                "iat_mean": flow_data["iat_mean"],
                                "iat_std": flow_data["iat_std"],
                                "iat_min": flow_data["iat_min"],
                                "iat_max": flow_data["iat_max"],
                                "payload_entropy": flow_data["payload_entropy"],
                                "features": {
                                    "packet_size_skew": flow_data["packet_size_skew"],
                                    "iat_entropy": flow_data["iat_entropy"],
                                    "is_c2_beacon": flow_data["is_c2_beacon"],
                                    "port_anomaly_flags": flow_data["port_anomaly_flags"],
                                    "ttl_fingerprint": flow_data["ttl_fingerprint"],
                                    "is_encrypted_exfiltration": flow_data["is_encrypted_exfiltration"],
                                    "ewma_stats": flow_data["ewma_stats"],
                                },
                            }
                            resp = await http_client.post(f"{api_url}/flows/ingest", json=payload)
                            if resp.status_code == 201:
                                print(f"    [API] Flow persisted successfully. ID: {resp.json().get('id')}")
                        except Exception as exc:
                            print(f"    [API Warning] Could not reach API: {exc}")

            if delay_per_packet > 0:
                await asyncio.sleep(delay_per_packet)

        # Final flush
        remaining = aggregator.flush_all()
        if remaining:
            print(f"[+] Final flush emitted {len(remaining)} flows.")
            for flow_data in remaining:
                log_flow_threat_summary(flow_data)

        elapsed = time.time() - start_wall
        actual_pps = packet_count / elapsed if elapsed > 0 else 0
        print(f"\n[*] Replay finished: {packet_count} packets in {elapsed:.2f}s (effective {actual_pps:.1f} pps)")

    finally:
        if http_client:
            await http_client.aclose()


def log_flow_threat_summary(flow: dict) -> None:
    """
    Prints a formatted threat detection summary for an extracted unidirectional flow.
    """
    key = f"{flow['src_ip']}:{flow['src_port']} -> {flow['dst_ip']}:{flow['dst_port']} [{flow['protocol']}]"
    print(f"\n--- [UNIDIRECTIONAL FLOW EVALUATION] ---")
    print(f"  5-Tuple:        {key}")
    print(f"  Duration:       {flow['duration_ms']:.1f} ms | Packets: {flow['packet_count']} | Bytes: {flow['byte_count']}")
    print(f"  Pkt Size Stats: mean={flow['packet_size_mean']}B, std={flow['packet_size_std']}B, skew={flow['packet_size_skew']}")
    print(f"  IAT Stats:      mean={flow['iat_mean']:.2f}ms, entropy={flow['iat_entropy']:.3f} (C2 Beacon: {flow['is_c2_beacon']})")
    print(f"  TTL Analysis:   initial={flow['ttl_fingerprint']['initial_ttl']}, hops={flow['ttl_fingerprint']['estimated_hops']}, OS={flow['ttl_fingerprint']['os_family']} (Spoofed: {flow['ttl_fingerprint']['is_ttl_spoofed']})")
    print(f"  Payload Entropy:{flow['payload_entropy']:.3f} (Encrypted Exfiltration: {flow['is_encrypted_exfiltration']})")
    print(f"  EWMA Volume:    pps={flow['ewma_stats']['current_pps']}, Z-score={flow['ewma_stats']['z_score_pps']} (Anomaly: {flow['ewma_stats']['is_volume_anomaly']})")


def main():
    parser = argparse.ArgumentParser(description="Synthetic PCAP Generator & Controlled Replay Engine")
    parser.add_argument("--rate", type=float, default=150.0, help="Replay rate in packets per second (pps)")
    parser.add_argument("--save-pcap", type=str, default=None, help="Save synthetic PCAP to file path")
    parser.add_argument("--input-pcap", type=str, default=None, help="Load an existing PCAP file instead of generating")
    parser.add_argument("--api-url", type=str, default=None, help="FastAPI v1 URL to ingest flows (e.g. http://localhost:8000/api/v1)")

    args = parser.parse_args()

    if args.input_pcap:
        print(f"[*] Reading input PCAP from: {args.input_pcap}")
        with open(args.input_pcap, "rb") as f:
            pcap_data = f.read()
    else:
        print("[*] Generating synthetic multi-threat unidirectional PCAP...")
        pcap_data = generate_synthetic_threat_pcap()
        print(f"[+] Synthetic PCAP generated ({len(pcap_data)} bytes).")

    if args.save_pcap:
        with open(args.save_pcap, "wb") as f:
            f.write(pcap_data)
        print(f"[+] Saved synthetic PCAP to: {args.save_pcap}")

    asyncio.run(replay_pcap_stream(pcap_bytes=pcap_data, rate_pps=args.rate, api_url=args.api_url))


if __name__ == "__main__":
    main()
