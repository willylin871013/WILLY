import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class SopCategory(Base):
    __tablename__ = "sop_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    documents: Mapped[list["SopDocument"]] = relationship(
        "SopDocument", back_populates="category", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<SopCategory id={self.id} name={self.name}>"


class SopTag(Base):
    __tablename__ = "sop_tags"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    document_tags: Mapped[list["SopDocumentTag"]] = relationship(
        "SopDocumentTag", back_populates="tag", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<SopTag id={self.id} name={self.name}>"


class SopDocument(Base):
    __tablename__ = "sop_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sop_categories.id", ondelete="SET NULL"), nullable=True
    )
    version: Mapped[str] = mapped_column(String(20), default="1.0", nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET DEFAULT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category: Mapped["SopCategory | None"] = relationship(
        "SopCategory", back_populates="documents", lazy="select"
    )
    creator: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[created_by], lazy="select"
    )
    document_tags: Mapped[list["SopDocumentTag"]] = relationship(
        "SopDocumentTag", back_populates="document", cascade="all, delete-orphan", lazy="select"
    )
    versions: Mapped[list["SopVersion"]] = relationship(
        "SopVersion", back_populates="document", cascade="all, delete-orphan", lazy="select",
        order_by="SopVersion.created_at.desc()"
    )

    def __repr__(self) -> str:
        return f"<SopDocument id={self.id} title={self.title}>"


class SopDocumentTag(Base):
    __tablename__ = "sop_document_tags"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sop_documents.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sop_tags.id", ondelete="CASCADE"), primary_key=True
    )

    document: Mapped["SopDocument"] = relationship(
        "SopDocument", back_populates="document_tags", lazy="select"
    )
    tag: Mapped["SopTag"] = relationship(
        "SopTag", back_populates="document_tags", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<SopDocumentTag doc={self.document_id} tag={self.tag_id}>"


class SopVersion(Base):
    __tablename__ = "sop_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sop_documents.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    change_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET DEFAULT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    document: Mapped["SopDocument"] = relationship(
        "SopDocument", back_populates="versions", lazy="select"
    )
    creator: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[created_by], lazy="select"
    )

    def __repr__(self) -> str:
        return f"<SopVersion id={self.id} doc={self.document_id} ver={self.version}>"


# Import User here to avoid circular imports but allow relationships to resolve
from app.models.user import User  # noqa: E402, F401
