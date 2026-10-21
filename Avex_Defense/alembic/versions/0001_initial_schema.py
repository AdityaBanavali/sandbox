"""0001_initial_schema

Initial database schema migration for Cyber Defense Enclave:
- flows: unidirectional flow telemetry and statistical features
- mitre_mappings: MITRE ATT&CK tactic & technique mapping
- alerts: threat alerts linked to flows and MITRE techniques
- audit_logs: cryptographically hash-chained tamper-evident ledger

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # Table: flows
    # -----------------------------------------------------------------------
    op.create_table(
        "flows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("src_ip", sa.String(length=45), nullable=False),
        sa.Column("dst_ip", sa.String(length=45), nullable=False),
        sa.Column("src_port", sa.Integer(), nullable=False),
        sa.Column("dst_port", sa.Integer(), nullable=False),
        sa.Column("protocol", sa.String(length=16), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_ms", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("packet_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("byte_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("packet_size_mean", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("packet_size_std", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("packet_size_min", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("packet_size_max", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("iat_mean", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("iat_std", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("iat_min", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("iat_max", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("payload_entropy", sa.Float(), nullable=True),
        sa.Column("features", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_flows_src_ip", "flows", ["src_ip"], unique=False)
    op.create_index("ix_flows_dst_ip", "flows", ["dst_ip"], unique=False)
    op.create_index("ix_flows_src_port", "flows", ["src_port"], unique=False)
    op.create_index("ix_flows_dst_port", "flows", ["dst_port"], unique=False)
    op.create_index("ix_flows_protocol", "flows", ["protocol"], unique=False)
    op.create_index("ix_flows_start_time", "flows", ["start_time"], unique=False)
    op.create_index("idx_flows_src_dst_time", "flows", ["src_ip", "dst_ip", "start_time"], unique=False)
    op.create_index("idx_flows_protocol_dst_port", "flows", ["protocol", "dst_port"], unique=False)

    # -----------------------------------------------------------------------
    # Table: mitre_mappings
    # -----------------------------------------------------------------------
    op.create_table(
        "mitre_mappings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tactic_name", sa.String(length=128), nullable=False),
        sa.Column("technique_id", sa.String(length=32), nullable=False),
        sa.Column("technique_name", sa.String(length=256), nullable=False),
        sa.Column("subtechnique_id", sa.String(length=32), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mitre_mappings_tactic_name", "mitre_mappings", ["tactic_name"], unique=False)
    op.create_index("ix_mitre_mappings_technique_id", "mitre_mappings", ["technique_id"], unique=True)

    # -----------------------------------------------------------------------
    # Table: alerts
    # -----------------------------------------------------------------------
    op.create_table(
        "alerts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("flow_id", sa.Uuid(), nullable=False),
        sa.Column("mitre_mapping_id", sa.Uuid(), nullable=True),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default="MEDIUM"),
        sa.Column("severity_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("behavior_class", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="NEW"),
        sa.Column("model_version", sa.String(length=64), nullable=False, server_default="v1.0.0"),
        sa.Column("explanation", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["flow_id"], ["flows.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mitre_mapping_id"], ["mitre_mappings.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alerts_flow_id", "alerts", ["flow_id"], unique=False)
    op.create_index("ix_alerts_mitre_mapping_id", "alerts", ["mitre_mapping_id"], unique=False)
    op.create_index("ix_alerts_severity", "alerts", ["severity"], unique=False)
    op.create_index("ix_alerts_behavior_class", "alerts", ["behavior_class"], unique=False)
    op.create_index("ix_alerts_status", "alerts", ["status"], unique=False)
    op.create_index("ix_alerts_timestamp", "alerts", ["timestamp"], unique=False)
    op.create_index("idx_alerts_severity_status", "alerts", ["severity", "status"], unique=False)
    op.create_index("idx_alerts_timestamp_behavior", "alerts", ["timestamp", "behavior_class"], unique=False)

    # -----------------------------------------------------------------------
    # Table: audit_logs (Tamper-evident hash-chained ledger)
    # -----------------------------------------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("sequence_number", sa.BigInteger(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("actor", sa.String(length=128), nullable=False, server_default="system"),
        sa.Column("previous_hash", sa.String(length=64), nullable=False),
        sa.Column("record_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("record_hash", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_sequence_number", "audit_logs", ["sequence_number"], unique=True)
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"], unique=False)
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"], unique=False)
    op.create_index("ix_audit_logs_record_hash", "audit_logs", ["record_hash"], unique=True)
    op.create_index("idx_audit_sequence_timestamp", "audit_logs", ["sequence_number", "timestamp"], unique=False)
    op.create_index("idx_audit_action_actor", "audit_logs", ["action", "actor"], unique=False)


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("alerts")
    op.drop_table("mitre_mappings")
    op.drop_table("flows")
