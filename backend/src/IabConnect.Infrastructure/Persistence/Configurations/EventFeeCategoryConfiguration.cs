using IabConnect.Domain.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-022 (E4-S1): EF configuration for <see cref="EventFeeCategory"/>.
/// </summary>
public sealed class EventFeeCategoryConfiguration : IEntityTypeConfiguration<EventFeeCategory>
{
    public void Configure(EntityTypeBuilder<EventFeeCategory> builder)
    {
        builder.ToTable("event_fee_categories");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(c => c.EventId).HasColumnName("event_id").IsRequired();
        builder.Property(c => c.Name).HasColumnName("name").HasMaxLength(EventFeeCategory.NameMaxLength).IsRequired();
        builder.Property(c => c.Description).HasColumnName("description").HasMaxLength(EventFeeCategory.DescriptionMaxLength);

        // Amount uses precision (18,2) to MATCH the Finance InvoiceItem precision, so E4-S2 copies
        // the value into an invoice item with no rounding surprise. (Note: this is intentionally
        // wider than the legacy Event.Cost (10,2) display column.)
        builder.Property(c => c.Amount).HasColumnName("amount").HasPrecision(18, 2).IsRequired();

        // ISO currency code (e.g. "CHF", "EUR"); stored as a fixed 3-char string. The Events module
        // deliberately does NOT reference the Finance FinanceCurrency enum (module decoupling).
        builder.Property(c => c.Currency).HasColumnName("currency").HasMaxLength(EventFeeCategory.CurrencyCodeLength).IsRequired();

        builder.Property(c => c.Applicability)
            .HasColumnName("applicability")
            .HasMaxLength(20)
            .HasConversion<string>()
            .HasDefaultValue(FeeApplicability.Everyone)
            .IsRequired();

        builder.Property(c => c.AvailableFrom).HasColumnName("available_from");
        builder.Property(c => c.AvailableUntil).HasColumnName("available_until");
        builder.Property(c => c.MaxQuantity).HasColumnName("max_quantity");
        builder.Property(c => c.IsActive).HasColumnName("is_active").HasDefaultValue(true).IsRequired();
        builder.Property(c => c.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(c => c.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(c => c.UpdatedAt).HasColumnName("updated_at");

        builder.HasOne<Event>()
            .WithMany()
            .HasForeignKey(c => c.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(c => c.EventId).HasDatabaseName("ix_event_fee_categories_event_id");

        // Filtered-unique: at most one ACTIVE category per (event, name). A retired (inactive)
        // category's name can be reused. Case-variant duplicates are additionally caught by the
        // repository's case-insensitive ActiveNameExistsAsync check.
        builder.HasIndex(c => new { c.EventId, c.Name })
            .IsUnique()
            .HasFilter("is_active = true")
            .HasDatabaseName("ux_event_fee_categories_event_active_name");

        builder.ToTable(t => t.HasCheckConstraint(
            "ck_event_fee_categories_amount_non_negative",
            "amount >= 0"));

        builder.Ignore(c => c.DomainEvents);
    }
}
