"""Yield analysis tables

Revision ID: 0004
Revises: 0003
Create Date: 2024-01-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- yield_products ---
    op.create_table(
        'yield_products',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('product_code', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        sa.UniqueConstraint('product_code'),
    )
    op.create_index(op.f('ix_yield_products_id'), 'yield_products', ['id'], unique=False)
    op.create_index(op.f('ix_yield_products_name'), 'yield_products', ['name'], unique=True)
    op.create_index(op.f('ix_yield_products_product_code'), 'yield_products', ['product_code'], unique=True)

    # --- yield_steps ---
    op.create_table(
        'yield_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('sequence_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_yield_steps_id'), 'yield_steps', ['id'], unique=False)
    op.create_index(op.f('ix_yield_steps_name'), 'yield_steps', ['name'], unique=False)

    # --- yield_loss_categories ---
    op.create_table(
        'yield_loss_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('color', sa.String(length=20), nullable=False, server_default='#ff4d4f'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index(op.f('ix_yield_loss_categories_id'), 'yield_loss_categories', ['id'], unique=False)
    op.create_index(op.f('ix_yield_loss_categories_name'), 'yield_loss_categories', ['name'], unique=True)

    # --- yield_records ---
    op.create_table(
        'yield_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('lot_id', sa.String(length=100), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('step_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('measurement_date', sa.Date(), nullable=False),
        sa.Column('yield_pct', sa.Float(), nullable=False),
        sa.Column('wafer_in', sa.Integer(), nullable=True),
        sa.Column('wafer_out', sa.Integer(), nullable=True),
        sa.Column('die_per_wafer', sa.Integer(), nullable=True),
        sa.Column('good_die', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['product_id'], ['yield_products.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['step_id'], ['yield_steps.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_yield_records_id'), 'yield_records', ['id'], unique=False)
    op.create_index(op.f('ix_yield_records_lot_id'), 'yield_records', ['lot_id'], unique=False)
    op.create_index(op.f('ix_yield_records_product_id'), 'yield_records', ['product_id'], unique=False)
    op.create_index(op.f('ix_yield_records_step_id'), 'yield_records', ['step_id'], unique=False)
    op.create_index(op.f('ix_yield_records_measurement_date'), 'yield_records', ['measurement_date'], unique=False)

    # --- yield_loss_records ---
    op.create_table(
        'yield_loss_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('yield_record_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('loss_pct', sa.Float(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['yield_record_id'], ['yield_records.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], ['yield_loss_categories.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_yield_loss_records_id'), 'yield_loss_records', ['id'], unique=False)
    op.create_index(op.f('ix_yield_loss_records_yield_record_id'), 'yield_loss_records', ['yield_record_id'], unique=False)
    op.create_index(op.f('ix_yield_loss_records_category_id'), 'yield_loss_records', ['category_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_yield_loss_records_category_id'), table_name='yield_loss_records')
    op.drop_index(op.f('ix_yield_loss_records_yield_record_id'), table_name='yield_loss_records')
    op.drop_index(op.f('ix_yield_loss_records_id'), table_name='yield_loss_records')
    op.drop_table('yield_loss_records')

    op.drop_index(op.f('ix_yield_records_measurement_date'), table_name='yield_records')
    op.drop_index(op.f('ix_yield_records_step_id'), table_name='yield_records')
    op.drop_index(op.f('ix_yield_records_product_id'), table_name='yield_records')
    op.drop_index(op.f('ix_yield_records_lot_id'), table_name='yield_records')
    op.drop_index(op.f('ix_yield_records_id'), table_name='yield_records')
    op.drop_table('yield_records')

    op.drop_index(op.f('ix_yield_loss_categories_name'), table_name='yield_loss_categories')
    op.drop_index(op.f('ix_yield_loss_categories_id'), table_name='yield_loss_categories')
    op.drop_table('yield_loss_categories')

    op.drop_index(op.f('ix_yield_steps_name'), table_name='yield_steps')
    op.drop_index(op.f('ix_yield_steps_id'), table_name='yield_steps')
    op.drop_table('yield_steps')

    op.drop_index(op.f('ix_yield_products_product_code'), table_name='yield_products')
    op.drop_index(op.f('ix_yield_products_name'), table_name='yield_products')
    op.drop_index(op.f('ix_yield_products_id'), table_name='yield_products')
    op.drop_table('yield_products')
