"""
Unidirectional Feature Extraction Engine for Data Diode / Unidirectional Network Taps.
Operates exclusively on one-sided traffic statistics without TCP three-way handshake return visibility.

Extracts:
1. Packet size distributions (mean, std, Fisher-Pearson skew).
2. Inter-arrival time (IAT) Shannon entropy over binned intervals (C2 beacon detection).
3. Protocol and port anomaly flags (unidirectional TCP state anomalies, port mismatches).
4. TTL fingerprinting & hop-count deduction for OS/device spoofing detection.
5. Payload Shannon entropy (encrypted exfiltration / covert channels).
6. Rolling baseline traffic volume metrics using Exponentially Weighted Moving Average (EWMA).
"""

import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


# Standard initial TTL values employed by operating systems
BASE_TTLS = [32, 64, 128, 255]

# Suspicious ports commonly utilized by C2 frameworks, reverse shells, and backdoors
SUSPICIOUS_PORTS = {
    4444, 5555, 6667, 8888, 9001, 9050, 1337, 31337, 8080, 8443, 4443, 2222, 1080
}

# Standard well-known ports and their expected transport protocols
WELL_KNOWN_PORTS = {
    53: "UDP",     # DNS predominantly UDP for queries
    67: "UDP",     # DHCP
    68: "UDP",     # DHCP
    80: "TCP",     # HTTP
    123: "UDP",    # NTP
    443: "TCP",    # HTTPS
    161: "UDP",    # SNMP
    514: "UDP",    # Syslog
}


@dataclass
class PacketRecord:
    """
    Decoded raw packet metadata captured from the unidirectional tap.
    """
    timestamp: float          # Epoch timestamp (seconds with microsecond precision)
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str             # "TCP", "UDP", "ICMP", "OTHER"
    packet_size: int          # Wire length in bytes
    ip_ttl: int
    tcp_flags: Dict[str, bool] = field(default_factory=dict)
    payload_bytes: bytes = b""


class EWMATracker:
    """
    Exponentially Weighted Moving Average (EWMA) volume baseline tracker.
    Maintains rolling average and variance of traffic metrics (packets/sec, bytes/sec)
    to perform adaptive Z-score thresholding without requiring rigid static baselines.
    """

    def __init__(self, alpha: float = 0.15, min_samples: int = 5):
        self.alpha = alpha
        self.min_samples = min_samples
        self.sample_count = 0
        self.mean_pps: float = 0.0
        self.var_pps: float = 0.0
        self.mean_bps: float = 0.0
        self.var_bps: float = 0.0

    def update(self, pps: float, bps: float) -> Tuple[float, float, bool]:
        """
        Updates EWMA statistics with latest observation.
        Returns:
            (z_score_pps, z_score_bps, is_anomaly)
        """
        self.sample_count += 1

        if self.sample_count == 1:
            self.mean_pps = pps
            self.var_pps = 0.0
            self.mean_bps = bps
            self.var_bps = 0.0
            return 0.0, 0.0, False

        # Compute deviations prior to mean update
        diff_pps = pps - self.mean_pps
        diff_bps = bps - self.mean_bps

        std_pps = math.sqrt(max(self.var_pps, 1e-4))
        std_bps = math.sqrt(max(self.var_bps, 1e-4))

        z_pps = diff_pps / std_pps if std_pps > 0 else 0.0
        z_bps = diff_bps / std_bps if std_bps > 0 else 0.0

        # Update EWMA mean
        self.mean_pps = self.alpha * pps + (1.0 - self.alpha) * self.mean_pps
        self.mean_bps = self.alpha * bps + (1.0 - self.alpha) * self.mean_bps

        # Update EWMA variance: var_t = (1 - alpha) * (var_{t-1} + alpha * diff^2)
        self.var_pps = (1.0 - self.alpha) * (self.var_pps + self.alpha * (diff_pps ** 2))
        self.var_bps = (1.0 - self.alpha) * (self.var_bps + self.alpha * (diff_bps ** 2))

        is_anomaly = (
            self.sample_count >= self.min_samples
            and (z_pps > 3.0 or z_bps > 3.0)
        )
        return round(z_pps, 2), round(z_bps, 2), is_anomaly


def calculate_shannon_entropy(data_bytes: bytes) -> float:
    """
    Computes Shannon entropy (0.0 to 8.0) across byte values 0-255.
    High entropy (> 7.2) strongly indicates encryption, compression, or covert tunneling.
    """
    if not data_bytes:
        return 0.0
    length = len(data_bytes)
    counts = Counter(data_bytes)
    entropy = 0.0
    for count in counts.values():
        p_x = count / length
        entropy -= p_x * math.log2(p_x)
    return round(entropy, 4)


def calculate_iat_shannon_entropy(iats_ms: List[float], num_bins: int = 16) -> Tuple[float, List[int]]:
    """
    Calculates Shannon entropy of Inter-Arrival Times (IAT) over discretized intervals.
    
    C2 Beaconing Detection:
    - Periodic malware beacons (Cobalt Strike, Sliver, Empire) transmit at highly regular
      intervals (e.g. 1.0s, 5.0s, 60.0s), concentrating IATs into a single bin.
      This produces an exceptionally LOW Shannon entropy (e.g., < 1.0 - 1.5).
    - Normal benign user/burst traffic has wide arrival distributions, producing HIGH entropy (> 2.5 - 3.5).
    """
    if len(iats_ms) < 2:
        return 0.0, []

    # Bin edges spanning from sub-millisecond to 10 seconds (hybrid logarithmic scale)
    bin_edges = [
        0.0, 1.0, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0,
        1000.0, 2000.0, 3000.0, 5000.0, 10000.0, 30000.0, 60000.0, float("inf")
    ]

    bin_counts = [0] * (len(bin_edges) - 1)
    for iat in iats_ms:
        for i in range(len(bin_edges) - 1):
            if bin_edges[i] <= iat < bin_edges[i + 1]:
                bin_counts[i] += 1
                break

    total = len(iats_ms)
    entropy = 0.0
    for count in bin_counts:
        if count > 0:
            p_k = count / total
            entropy -= p_k * math.log2(p_k)

    return round(entropy, 4), bin_counts


def deduce_initial_ttl(observed_ttl: int) -> Tuple[int, int, str]:
    """
    Deduces initial operating system TTL and estimated network hops.
    Returns:
        (base_initial_ttl, estimated_hops, os_family)
    """
    for base in BASE_TTLS:
        if observed_ttl <= base:
            hops = base - observed_ttl
            if base == 64:
                os_family = "Linux/Unix/macOS"
            elif base == 128:
                os_family = "Windows"
            elif base == 255:
                os_family = "Network Appliance/Cisco"
            else:
                os_family = "Legacy/Embedded"
            return base, hops, os_family

    return 255, max(0, 255 - observed_ttl), "Unknown"


def calculate_distribution_stats(values: List[float]) -> Tuple[float, float, float, float, float]:
    """
    Computes mean, standard deviation, min, max, and Fisher-Pearson skewness:
    g_1 = m_3 / (m_2^(3/2))
    """
    if not values:
        return 0.0, 0.0, 0.0, 0.0, 0.0

    n = len(values)
    arr = np.asarray(values, dtype=float)
    mean_val = float(np.mean(arr))
    min_val = float(np.min(arr))
    max_val = float(np.max(arr))

    if n < 2:
        return round(mean_val, 2), 0.0, round(min_val, 2), round(max_val, 2), 0.0

    std_val = float(np.std(arr, ddof=1))

    # Fisher-Pearson standardized 3rd moment coefficient
    diff = arr - mean_val
    m2 = float(np.mean(diff ** 2))
    m3 = float(np.mean(diff ** 3))

    if m2 > 1e-6:
        skew_val = float(m3 / (m2 ** 1.5))
    else:
        skew_val = 0.0


    return (
        round(mean_val, 2),
        round(std_val, 2),
        round(min_val, 2),
        round(max_val, 2),
        round(skew_val, 4),
    )


class UnidirectionalFlowWindow:
    """
    Aggregates one-sided packets for a unidirectional flow 5-tuple:
    (src_ip, dst_ip, src_port, dst_port, protocol).
    """

    def __init__(
        self,
        src_ip: str,
        dst_ip: str,
        src_port: int,
        dst_port: int,
        protocol: str,
        ewma_tracker: Optional[EWMATracker] = None,
    ):
        self.src_ip = src_ip
        self.dst_ip = dst_ip
        self.src_port = src_port
        self.dst_port = dst_port
        self.protocol = protocol.upper()

        self.packets: List[PacketRecord] = []
        self.start_time: float = 0.0
        self.last_time: float = 0.0
        self.total_bytes: int = 0
        self.all_payload_bytes: bytearray = bytearray()
        self.ewma_tracker = ewma_tracker or EWMATracker()

    def add_packet(self, pkt: PacketRecord) -> None:
        """
        Appends a packet record to the flow aggregation window.
        """
        if not self.packets:
            self.start_time = pkt.timestamp
        self.last_time = pkt.timestamp
        self.total_bytes += pkt.packet_size
        if pkt.payload_bytes:
            self.all_payload_bytes.extend(pkt.payload_bytes)
        self.packets.append(pkt)

    @property
    def packet_count(self) -> int:
        return len(self.packets)

    @property
    def duration_ms(self) -> float:
        if len(self.packets) <= 1:
            return 0.0
        return round((self.last_time - self.start_time) * 1000.0, 2)

    def extract_features(self) -> Dict[str, Any]:
        """
        Computes the complete set of 6 unidirectional cyber defense features:
        1. Packet size distribution (mean, std, min, max, skew).
        2. IAT Shannon entropy over binned intervals (C2 beacon detection).
        3. Protocol and port anomaly flags.
        4. TTL fingerprinting & OS/device spoofing detection.
        5. Payload Shannon entropy.
        6. Rolling baseline traffic volume metrics using EWMA.
        """
        packet_count = len(self.packets)
        duration_s = max(self.last_time - self.start_time, 1e-4)

        # -------------------------------------------------------------------
        # 1. Packet Size Distributions
        # -------------------------------------------------------------------
        sizes = [float(p.packet_size) for p in self.packets]
        size_mean, size_std, size_min, size_max, size_skew = calculate_distribution_stats(sizes)

        # -------------------------------------------------------------------
        # 2. Inter-Arrival Time (IAT) & Binned Shannon Entropy (C2 Detection)
        # -------------------------------------------------------------------
        iats_ms: List[float] = []
        for i in range(1, packet_count):
            delta_ms = (self.packets[i].timestamp - self.packets[i - 1].timestamp) * 1000.0
            iats_ms.append(max(0.0, delta_ms))

        iat_mean, iat_std, iat_min, iat_max, _ = calculate_distribution_stats(iats_ms)
        iat_entropy, iat_bins = calculate_iat_shannon_entropy(iats_ms)

        # C2 Beaconing Heuristic: Regular periodicity produces low entropy & low coefficient of variation
        is_c2_beacon = False
        if packet_count >= 6 and iat_entropy < 1.35:
            # Low timing jitter
            cov = (iat_std / (iat_mean + 1e-4)) if iat_mean > 0 else 1.0
            if cov < 0.25:
                is_c2_beacon = True

        # -------------------------------------------------------------------
        # 3. Protocol and Port Anomaly Flags
        # -------------------------------------------------------------------
        port_flags = {
            "is_suspicious_port": (self.dst_port in SUSPICIOUS_PORTS or self.src_port in SUSPICIOUS_PORTS),
            "is_reserved_target": self.dst_port < 1024,
            "port_protocol_mismatch": False,
            "syn_without_ack_return": False,
            "orphan_ack_stream": False,
            "rst_flood": False,
            "fin_probe": False,
            "null_or_xmas_flags": False,
        }

        # Check well-known protocol alignment
        if self.dst_port in WELL_KNOWN_PORTS:
            expected = WELL_KNOWN_PORTS[self.dst_port]
            if self.protocol != expected:
                port_flags["port_protocol_mismatch"] = True

        # Check unidirectional TCP state markers
        if self.protocol == "TCP":
            syn_count = sum(1 for p in self.packets if p.tcp_flags.get("SYN", False))
            ack_count = sum(1 for p in self.packets if p.tcp_flags.get("ACK", False))
            rst_count = sum(1 for p in self.packets if p.tcp_flags.get("RST", False))
            fin_count = sum(1 for p in self.packets if p.tcp_flags.get("FIN", False))

            if syn_count > 0 and ack_count == 0:
                port_flags["syn_without_ack_return"] = True
            elif syn_count == 0 and ack_count == packet_count:
                port_flags["orphan_ack_stream"] = True

            if rst_count >= 3:
                port_flags["rst_flood"] = True
            if fin_count > 0 and ack_count == 0:
                port_flags["fin_probe"] = True

            # Null scan or Xmas scan flags
            for p in self.packets:
                flags = p.tcp_flags
                active_flags = sum(1 for v in flags.values() if v)
                if active_flags == 0:
                    port_flags["null_or_xmas_flags"] = True
                    break
                if flags.get("FIN") and flags.get("PSH") and flags.get("URG"):
                    port_flags["null_or_xmas_flags"] = True
                    break

        # -------------------------------------------------------------------
        # 4. TTL Fingerprinting & OS/Device Spoofing Detection
        # -------------------------------------------------------------------
        observed_ttls = [p.ip_ttl for p in self.packets]
        unique_ttls = list(set(observed_ttls))
        first_ttl = observed_ttls[0] if observed_ttls else 64
        base_ttl, estimated_hops, os_family = deduce_initial_ttl(first_ttl)

        ttl_variance = float(np.var(observed_ttls)) if len(observed_ttls) > 1 else 0.0

        # Spoofing Detection: Fluctuating base TTLs or hops fluctuation within same flow
        is_ttl_spoofed = False
        if len(unique_ttls) > 1:
            base_set = {deduce_initial_ttl(t)[0] for t in unique_ttls}
            if len(base_set) > 1 or ttl_variance > 4.0:
                is_ttl_spoofed = True

        ttl_fingerprint = {
            "initial_ttl": base_ttl,
            "observed_ttl_sample": first_ttl,
            "estimated_hops": estimated_hops,
            "os_family": os_family,
            "unique_ttls_count": len(unique_ttls),
            "ttl_variance": round(ttl_variance, 2),
            "is_ttl_spoofed": is_ttl_spoofed,
        }

        # -------------------------------------------------------------------
        # 5. Payload Shannon Entropy
        # -------------------------------------------------------------------
        payload_entropy = calculate_shannon_entropy(bytes(self.all_payload_bytes))
        is_encrypted_exfiltration = payload_entropy >= 7.2 and len(self.all_payload_bytes) > 256

        # -------------------------------------------------------------------
        # 6. Rolling Baseline Traffic Volume with EWMA
        # -------------------------------------------------------------------
        pps = packet_count / duration_s
        bps = self.total_bytes / duration_s

        z_pps, z_bps, is_volume_burst = self.ewma_tracker.update(pps=pps, bps=bps)

        ewma_stats = {
            "current_pps": round(pps, 2),
            "current_bps": round(bps, 2),
            "ewma_mean_pps": round(self.ewma_tracker.mean_pps, 2),
            "ewma_mean_bps": round(self.ewma_tracker.mean_bps, 2),
            "z_score_pps": z_pps,
            "z_score_bps": z_bps,
            "is_volume_anomaly": is_volume_burst,
        }

        # Format ISO timestamp
        start_dt = datetime.fromtimestamp(self.start_time, tz=timezone.utc)
        end_dt = datetime.fromtimestamp(self.last_time, tz=timezone.utc)

        return {
            # 5-tuple
            "src_ip": self.src_ip,
            "dst_ip": self.dst_ip,
            "src_port": self.src_port,
            "dst_port": self.dst_port,
            "protocol": self.protocol,
            "start_time": start_dt,
            "end_time": end_dt,
            "duration_ms": self.duration_ms,
            "packet_count": packet_count,
            "byte_count": self.total_bytes,
            # 1. Packet size distribution
            "packet_size_mean": size_mean,
            "packet_size_std": size_std,
            "packet_size_min": size_min,
            "packet_size_max": size_max,
            "packet_size_skew": size_skew,
            # 2. Inter-arrival time distribution & entropy
            "iat_mean": iat_mean,
            "iat_std": iat_std,
            "iat_min": iat_min,
            "iat_max": iat_max,
            "iat_entropy": iat_entropy,
            "is_c2_beacon": is_c2_beacon,
            # 3. Protocol and port anomaly flags
            "port_anomaly_flags": port_flags,
            # 4. TTL fingerprinting & OS spoofing
            "ttl_fingerprint": ttl_fingerprint,
            # 5. Payload entropy
            "payload_entropy": payload_entropy,
            "is_encrypted_exfiltration": is_encrypted_exfiltration,
            # 6. EWMA baseline
            "ewma_stats": ewma_stats,
        }
