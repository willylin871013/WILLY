"""SOP knowledge base tables

Revision ID: 0002
Revises: 0001
Create Date: 2024-01-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- sop_categories ---
    op.create_table(
        'sop_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index(op.f('ix_sop_categories_id'), 'sop_categories', ['id'], unique=False)
    op.create_index(op.f('ix_sop_categories_name'), 'sop_categories', ['name'], unique=True)

    # --- sop_tags ---
    op.create_table(
        'sop_tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_index(op.f('ix_sop_tags_id'), 'sop_tags', ['id'], unique=False)
    op.create_index(op.f('ix_sop_tags_name'), 'sop_tags', ['name'], unique=True)

    # --- sop_documents ---
    op.create_table(
        'sop_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('version', sa.String(length=20), nullable=False, server_default='1.0'),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=True),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['category_id'], ['sop_categories.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_sop_documents_id'), 'sop_documents', ['id'], unique=False)
    op.create_index(op.f('ix_sop_documents_title'), 'sop_documents', ['title'], unique=False)

    # --- sop_document_tags ---
    op.create_table(
        'sop_document_tags',
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['sop_documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['sop_tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('document_id', 'tag_id'),
    )

    # --- sop_versions ---
    op.create_table(
        'sop_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version', sa.String(length=20), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=True),
        sa.Column('change_notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['document_id'], ['sop_documents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_sop_versions_id'), 'sop_versions', ['id'], unique=False)
    op.create_index(op.f('ix_sop_versions_document_id'), 'sop_versions', ['document_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_sop_versions_document_id'), table_name='sop_versions')
    op.drop_index(op.f('ix_sop_versions_id'), table_name='sop_versions')
    op.drop_table('sop_versions')

    op.drop_table('sop_document_tags')

    op.drop_index(op.f('ix_sop_documents_title'), table_name='sop_documents')
    op.drop_index(op.f('ix_sop_documents_id'), table_name='sop_documents')
    op.drop_table('sop_documents')

    op.drop_index(op.f('ix_sop_tags_name'), table_name='sop_tags')
    op.drop_index(op.f('ix_sop_tags_id'), table_name='sop_tags')
    op.drop_table('sop_tags')

    op.drop_index(op.f('ix_sop_categories_name'), table_name='sop_categories')
    op.drop_index(op.f('ix_sop_categories_id'), table_name='sop_categories')
    op.drop_table('sop_categories')
