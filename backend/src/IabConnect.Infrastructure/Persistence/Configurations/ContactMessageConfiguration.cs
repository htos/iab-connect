using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

public sealed class ContactMessageConfiguration : IEntityTypeConfiguration<ContactMessage>
{
    public void Configure(EntityTypeBuilder<ContactMessage> builder)
    {
        builder.ToTable("contact_messages");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(c => c.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(c => c.Email).HasColumnName("email").HasMaxLength(200).IsRequired();
        builder.Property(c => c.Subject).HasColumnName("subject").HasMaxLength(200).IsRequired();
        builder.Property(c => c.Message).HasColumnName("message").HasMaxLength(5000).IsRequired();
        builder.Property(c => c.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(c => c.ResponseNotes).HasColumnName("response_notes").HasMaxLength(2000);
        builder.Property(c => c.RespondedAt).HasColumnName("responded_at");
        builder.Property(c => c.RespondedBy).HasColumnName("responded_by");

        // Audit fields from AggregateRoot
        builder.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(c => c.CreatedBy).HasColumnName("created_by");
        builder.Property(c => c.UpdatedAt).HasColumnName("updated_at");
        builder.Property(c => c.UpdatedBy).HasColumnName("updated_by");
        builder.Property(c => c.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false).IsRequired();
        builder.Property(c => c.DeletedAt).HasColumnName("deleted_at");
        builder.Property(c => c.DeletedBy).HasColumnName("deleted_by");

        builder.HasIndex(c => c.Status).HasDatabaseName("ix_contact_messages_status");
        builder.HasIndex(c => c.CreatedAt).HasDatabaseName("ix_contact_messages_created_at");

        builder.HasQueryFilter(c => !c.IsDeleted);
        builder.Ignore(c => c.DomainEvents);
    }
}
