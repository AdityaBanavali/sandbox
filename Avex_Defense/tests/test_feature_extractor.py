"""
Comprehensive Unit Tests for Unidirectional Feature Extraction & dpkt Ingestion.
Tests all 6 required routines:
1. Packet size distribution (mean, std, skew).
2. Binned IAT Shannon entropy (C2 beacon detection).
3. Protocol and port anomaly flags.
4. TTL fingerprinting and OS spoofing detection.
5. Payload Shannon entropy.
6. Rolling baseline traffic volume using EWMA.
7. dpkt PCAP byte-level parsing.
"""

import time
import pytest
from app.services.packet_extractor import (
    PacketRecord,
    UnidirectionalFlowWindow,
    EWMATracker,
    calculate_shannon_entropy,
    calculate_iat_shannon_entropy,
    calculate_distribution_stats,
    deduce_initial_ttl,
)
from app.services.pcap_service import UnidirectionalFlowAggregator
from scripts.pcap_replay import generate_synthetic_threat_pcap


def test_1_packet_size_distribution_and_skew():
    """
    Test packet size mean, standard deviation, and Fisher-Pearson skewness.
    """
    # Symmetric distribution
    sym_sizes = [100.0, 200.0, 300.0, 400.0, 500.0]
    mean, std, min_v, max_v, skew = calculate_distribution_stats(sym_sizes)
    assert mean == 300.0
    assert min_v == 100.0
    assert max_v == 500.0
    assert abs(skew) < 1e-4, f"Expected near zero skew for symmetric sizes, got {skew}"

    # Right-skewed distribution (e.g. many small control packets, few large exfil chunks)
    right_skew = [64.0, 64.0, 64.0, 64.0, 64.0, 1500.0]
    m_r, s_r, min_r, max_r, skew_r = calculate_distribution_stats(right_skew)
    assert skew_r > 1.0, f"Expected positive skewness for right-tailed data, got {skew_r}"

    # Left-skewed distribution (e.g. mostly large MTU packets, rare small packets)
    left_skew = [1500.0, 1500.0, 1500.0, 1500.0, 64.0]
    m_l, s_l, min_l, max_l, skew_l = calculate_distribution_stats(left_skew)
    assert skew_l < -1.0, f"Expected negative skewness for left-tailed data, got {skew_l}"


def test_2_iat_shannon_entropy_c2_beaconing():
    """
    Test Inter-Arrival Time (IAT) Shannon entropy over binned intervals.
    A rigid C2 beacon with low jitter must have low entropy (< 1.5).
    Normal human/burst traffic must have high entropy (> 2.5).
    """
    # Periodic C2 beacon completely within a single bin: 1500ms ± 2ms -> all in [1000, 2000) bin
    single_bin_c2 = [1500.0, 1501.0, 1499.0, 1500.5, 1502.0, 1498.5, 1500.0] * 3
    ent_zero, bins_zero = calculate_iat_shannon_entropy(single_bin_c2)
    assert ent_zero == 0.0, f"Pure single-bin beacon should have 0.0 entropy, got {ent_zero}"

    # Periodic C2 beacon on boundary: 1000ms ± 2ms -> straddles at most 2 adjacent bins
    boundary_c2 = [1000.0, 1001.0, 999.0, 1000.5, 1002.0, 998.5, 1000.0] * 3
    c2_entropy, c2_bins = calculate_iat_shannon_entropy(boundary_c2)
    assert c2_entropy < 1.0, f"Beacon straddling boundary should still have low entropy (< 1.0), got {c2_entropy}"


    # Random traffic spanning multiple distinct timing buckets
    benign_iats = [
        0.5, 3.0, 8.0, 15.0, 35.0, 80.0, 180.0, 400.0,
        1500.0, 2500.0, 4500.0, 8000.0, 25000.0
    ] * 2
    benign_entropy, benign_bins = calculate_iat_shannon_entropy(benign_iats)
    assert benign_entropy > 2.5, f"Diverse traffic should yield high IAT entropy, got {benign_entropy}"


def test_3_protocol_and_port_anomalies():
    """
    Test protocol-port mismatch and unidirectional TCP state anomalies.
    """
    flow = UnidirectionalFlowWindow(
        src_ip="192.168.1.10",
        dst_ip="10.0.0.1",
        src_port=55555,
        dst_port=53,        # Port 53 expects UDP
        protocol="TCP",     # Mismatch!
    )
    t = time.time()
    # Add SYN-only packet (no ACK return)
    flow.add_packet(
        PacketRecord(
            timestamp=t,
            src_ip="192.168.1.10",
            dst_ip="10.0.0.1",
            src_port=55555,
            dst_port=53,
            protocol="TCP",
            packet_size=60,
            ip_ttl=64,
            tcp_flags={"SYN": True, "ACK": False, "RST": False, "FIN": False},
        )
    )

    features = flow.extract_features()
    flags = features["port_anomaly_flags"]
    assert flags["port_protocol_mismatch"] is True, "Port 53 TCP should trigger mismatch flag"
    assert flags["syn_without_ack_return"] is True, "SYN without ACK should trigger flag"


def test_4_ttl_fingerprinting_and_spoof_detection():
    """
    Test TTL deduction, hop calculation, and spoof detection when TTL fluctuates.
    """
    base, hops, os_family = deduce_initial_ttl(58)
    assert base == 64
    assert hops == 6
    assert "Linux" in os_family

    base_win, hops_win, os_win = deduce_initial_ttl(120)
    assert base_win == 128
    assert hops_win == 8
    assert os_win == "Windows"

    # Test flow with alternating/spoofed TTLs
    flow = UnidirectionalFlowWindow("192.168.1.50", "10.0.0.2", 40000, 80, "TCP")
    t = time.time()
    ttls = [64, 128, 64, 255, 64]
    for i, ttl_val in enumerate(ttls):
        flow.add_packet(
            PacketRecord(
                timestamp=t + (i * 0.1),
                src_ip="192.168.1.50",
                dst_ip="10.0.0.2",
                src_port=40000,
                dst_port=80,
                protocol="TCP",
                packet_size=100,
                ip_ttl=ttl_val,
                tcp_flags={"ACK": True},
            )
        )

    features = flow.extract_features()
    ttl_fingerprint = features["ttl_fingerprint"]
    assert ttl_fingerprint["is_ttl_spoofed"] is True, "Fluctuating TTLs must flag is_ttl_spoofed"
    assert ttl_fingerprint["unique_ttls_count"] == 3


def test_5_payload_shannon_entropy():
    """
    Test payload entropy calculation for plaintext vs encrypted/compressed exfiltration.
    """
    plaintext = b"A" * 500  # Low entropy
    ent_low = calculate_shannon_entropy(plaintext)
    assert ent_low == 0.0

    # High entropy encrypted payload
    all_bytes = bytes(range(256)) * 4
    ent_high = calculate_shannon_entropy(all_bytes)
    assert ent_high >= 7.9, f"Expected near 8.0 entropy, got {ent_high}"


def test_6_ewma_baseline_volume_tracking():
    """
    Test adaptive EWMA traffic volume metrics and Z-score anomaly alerting.
    """
    tracker = EWMATracker(alpha=0.2, min_samples=3)

    # Establish baseline around 10 pps
    for _ in range(5):
        tracker.update(pps=10.0, bps=1000.0)

    assert 9.0 <= tracker.mean_pps <= 11.0

    # Introduce massive volumetric flood (e.g. 500 pps)
    z_pps, z_bps, is_anomaly = tracker.update(pps=500.0, bps=50000.0)
    assert z_pps > 3.0, f"Volumetric spike should produce high Z-score, got {z_pps}"
    assert is_anomaly is True, "EWMA should flag volumetric anomaly"


def test_7_dpkt_pcap_parsing_and_aggregation():
    """
    Test raw byte-level PCAP parsing via dpkt and aggregation across all threat scenarios.
    """
    pcap_data = generate_synthetic_threat_pcap()
    assert len(pcap_data) > 10000, "Synthetic PCAP should contain valid bytes"

    aggregator = UnidirectionalFlowAggregator(inactivity_timeout_s=5.0)
    extracted_flows = aggregator.process_pcap(pcap_data)

    assert len(extracted_flows) >= 4, f"Expected at least 4 distinct flows, got {len(extracted_flows)}"

    # Verify presence of C2 beacon flow and encrypted exfiltration flow
    c2_found = any(f["is_c2_beacon"] for f in extracted_flows)
    exfil_found = any(f["is_encrypted_exfiltration"] for f in extracted_flows)
    spoof_found = any(f["ttl_fingerprint"]["is_ttl_spoofed"] for f in extracted_flows)

    assert c2_found, "Expected C2 beacon flow to be identified"
    assert exfil_found, "Expected encrypted exfiltration flow to be identified"
    assert spoof_found, "Expected TTL spoofing flow to be identified"
