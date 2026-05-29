"""Equipment, alarm, maintenance, and PM schedule tables

Revision ID: 0005
Revises: 0004
Create Date: 2024-01-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- equipment ---
    op.create_table(
        'equipment',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('equipment_id', sa.String(length=100), nullable=False),
        sa.Column('equipment_type', sa.String(length=100), nullable=False),
        sa.Column('location', sa.String(length=200), nullable=True),
        sa.Column(
            'status',
            sa.Enum('normal', 'alarm', 'down', 'maintenance', 'pm', name='equipmentstatus'),
            nullable=False,
            server_default='normal',
        ),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('equipment_id'),
    )
    op.create_index(op.f('ix_equipment_id'), 'equipment', ['id'], unique=False)
    op.create_index(op.f('ix_equipment_equipment_id'), 'equipment', ['equipment_id'], unique=True)

    # --- alarm_records ---
    op.create_table(
        'alarm_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('equipment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('alarm_code', sa.String(length=100), nullable=True),
        sa.Column('alarm_type', sa.String(length=100), nullable=True),
        sa.Column(
            'severity',
            sa.Enum('low', 'medium', 'high', 'critical', name='alarmseverity'),
            nullable=False,
            server_default='medium',
        ),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('occurred_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('downtime_minutes', sa.Integer(), nullable=True),
        sa.Column('root_cause', sa.Text(), nullable=True),
        sa.Column('corrective_action', sa.Text(), nullable=True),
        sa.Column('reported_by', sa.Integer(), nullable=False),
        sa.Column('resolved_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['reported_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_alarm_records_id'), 'alarm_records', ['id'], unique=False)
    op.create_index(op.f('ix_alarm_records_equipment_id'), 'alarm_records', ['equipment_id'], unique=False)
    op.create_index(op.f('ix_alarm_records_occurred_at'), 'alarm_records', ['occurred_at'], unique=False)

    # --- maintenance_records ---
    op.create_table(
        'maintenance_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('equipment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            'maintenance_type',
            sa.Enum('repair', 'pm', 'calibration', 'inspection', name='maintenancetype'),
            nullable=False,
        ),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime(), nullable=True),
        sa.Column('engineer_id', sa.Integer(), nullable=True),
        sa.Column('parts_replaced', sa.Text(), nullable=True),
        sa.Column('cost', sa.Float(), nullable=True),
        sa.Column('result', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['engineer_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_maintenance_records_id'), 'maintenance_records', ['id'], unique=False)
    op.create_index(op.f('ix_maintenance_records_equipment_id'), 'maintenance_records', ['equipment_id'], unique=False)
    op.create_index(op.f('ix_maintenance_records_start_time'), 'maintenance_records', ['start_time'], unique=False)

    # --- pm_schedules ---
    op.create_table(
        'pm_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('equipment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('pm_name', sa.String(length=200), nullable=False),
        sa.Column('interval_days', sa.Integer(), nullable=False),
        sa.Column('last_pm_date', sa.Date(), nullable=True),
        sa.Column('next_pm_date', sa.Date(), nullable=True),
        sa.Column('estimated_duration_hours', sa.Float(), nullable=True),
        sa.Column('procedure_notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['equipment_id'], ['equipment.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_pm_schedules_id'), 'pm_schedules', ['id'], unique=False)
    op.create_index(op.f('ix_pm_schedules_equipment_id'), 'pm_schedules', ['equipment_id'], unique=False)

    # --- pm_records ---
    op.create_table(
        'pm_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('schedule_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('maintenance_record_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('completed_date', sa.Date(), nullable=False),
        sa.Column('completed_by', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['schedule_id'], ['pm_schedules.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['maintenance_record_id'], ['maintenance_records.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['completed_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_pm_records_id'), 'pm_records', ['id'], unique=False)
    op.create_index(op.f('ix_pm_records_schedule_id'), 'pm_records', ['schedule_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_pm_records_schedule_id'), table_name='pm_records')
    op.drop_index(op.f('ix_pm_records_id'), table_name='pm_records')
    op.drop_table('pm_records')

    op.drop_index(op.f('ix_pm_schedules_equipment_id'), table_name='pm_schedules')
    op.drop_index(op.f('ix_pm_schedules_id'), table_name='pm_schedules')
    op.drop_table('pm_schedules')

    op.drop_index(op.f('ix_maintenance_records_start_time'), table_name='maintenance_records')
    op.drop_index(op.f('ix_maintenance_records_equipment_id'), table_name='maintenance_records')
    op.drop_index(op.f('ix_maintenance_records_id'), table_name='maintenance_records')
    op.drop_table('maintenance_records')

    op.drop_index(op.f('ix_alarm_records_occurred_at'), table_name='alarm_records')
    op.drop_index(op.f('ix_alarm_records_equipment_id'), table_name='alarm_records')
    op.drop_index(op.f('ix_alarm_records_id'), table_name='alarm_records')
    op.drop_table('alarm_records')

    op.drop_index(op.f('ix_equipment_equipment_id'), table_name='equipment')
    op.drop_index(op.f('ix_equipment_id'), table_name='equipment')
    op.drop_table('equipment')

    op.execute("DROP TYPE IF EXISTS equipmentstatus")
    op.execute("DROP TYPE IF EXISTS alarmseverity")
    op.execute("DROP TYPE IF EXISTS maintenancetype")
