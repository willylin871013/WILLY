"""Process parameter management tables

Revision ID: 0003
Revises: 0002
Create Date: 2024-01-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- process_recipes ---
    op.create_table(
        'process_recipes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('process_type', sa.String(length=50), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index(op.f('ix_process_recipes_id'), 'process_recipes', ['id'], unique=False)
    op.create_index(op.f('ix_process_recipes_name'), 'process_recipes', ['name'], unique=True)
    op.create_index(op.f('ix_process_recipes_process_type'), 'process_recipes', ['process_type'], unique=False)

    # --- process_parameters ---
    op.create_table(
        'process_parameters',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('spec_min', sa.Float(), nullable=True),
        sa.Column('spec_max', sa.Float(), nullable=True),
        sa.Column('target', sa.Float(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['recipe_id'], ['process_recipes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_process_parameters_id'), 'process_parameters', ['id'], unique=False)
    op.create_index(op.f('ix_process_parameters_recipe_id'), 'process_parameters', ['recipe_id'], unique=False)

    # --- process_runs ---
    op.create_table(
        'process_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('recipe_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('lot_id', sa.String(length=100), nullable=False),
        sa.Column('run_date', sa.Date(), nullable=False),
        sa.Column('operator_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['recipe_id'], ['process_recipes.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['operator_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_process_runs_id'), 'process_runs', ['id'], unique=False)
    op.create_index(op.f('ix_process_runs_lot_id'), 'process_runs', ['lot_id'], unique=False)
    op.create_index(op.f('ix_process_runs_recipe_id'), 'process_runs', ['recipe_id'], unique=False)
    op.create_index(op.f('ix_process_runs_run_date'), 'process_runs', ['run_date'], unique=False)

    # --- process_measurements ---
    op.create_table(
        'process_measurements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('parameter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('is_out_of_spec', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['run_id'], ['process_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parameter_id'], ['process_parameters.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_process_measurements_id'), 'process_measurements', ['id'], unique=False)
    op.create_index(op.f('ix_process_measurements_run_id'), 'process_measurements', ['run_id'], unique=False)
    op.create_index(op.f('ix_process_measurements_parameter_id'), 'process_measurements', ['parameter_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_process_measurements_parameter_id'), table_name='process_measurements')
    op.drop_index(op.f('ix_process_measurements_run_id'), table_name='process_measurements')
    op.drop_index(op.f('ix_process_measurements_id'), table_name='process_measurements')
    op.drop_table('process_measurements')

    op.drop_index(op.f('ix_process_runs_run_date'), table_name='process_runs')
    op.drop_index(op.f('ix_process_runs_recipe_id'), table_name='process_runs')
    op.drop_index(op.f('ix_process_runs_lot_id'), table_name='process_runs')
    op.drop_index(op.f('ix_process_runs_id'), table_name='process_runs')
    op.drop_table('process_runs')

    op.drop_index(op.f('ix_process_parameters_recipe_id'), table_name='process_parameters')
    op.drop_index(op.f('ix_process_parameters_id'), table_name='process_parameters')
    op.drop_table('process_parameters')

    op.drop_index(op.f('ix_process_recipes_process_type'), table_name='process_recipes')
    op.drop_index(op.f('ix_process_recipes_name'), table_name='process_recipes')
    op.drop_index(op.f('ix_process_recipes_id'), table_name='process_recipes')
    op.drop_table('process_recipes')
