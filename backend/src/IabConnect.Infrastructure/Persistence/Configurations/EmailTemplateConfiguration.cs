namespace IabConnect.Infrastructure.Persistence.Configurations;

using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public class EmailTemplateConfiguration : IEntityTypeConfiguration<EmailTemplate>
{
    public void Configure(EntityTypeBuilder<EmailTemplate> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(e => e.Subject)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(e => e.HtmlContent)
            .IsRequired();

        builder.Property(e => e.TextContent)
            .IsRequired();

        builder.Property(e => e.Category)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(e => e.Description)
            .HasMaxLength(1000);

        builder.HasMany(e => e.Variables)
            .WithOne()
            .HasForeignKey(v => v.EmailTemplateId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.IsActive);
        builder.HasIndex(e => e.Category);
        builder.HasIndex(e => e.Name);
    }
}
