using IabConnect.Domain.Blog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

public sealed class BlogPostConfiguration : IEntityTypeConfiguration<BlogPost>
{
    public void Configure(EntityTypeBuilder<BlogPost> builder)
    {
        builder.ToTable("blog_posts");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(b => b.Title).HasColumnName("title").HasMaxLength(300).IsRequired();
        builder.Property(b => b.Slug).HasColumnName("slug").HasMaxLength(300).IsRequired();
        builder.Property(b => b.Content).HasColumnName("content").IsRequired();
        builder.Property(b => b.Excerpt).HasColumnName("excerpt").HasMaxLength(500);
        builder.Property(b => b.Author).HasColumnName("author").HasMaxLength(200).IsRequired();
        builder.Property(b => b.Category).HasColumnName("category").HasMaxLength(100).IsRequired();
        builder.Property(b => b.Tags).HasColumnName("tags").HasConversion(
            v => string.Join(",", v),
            v => v.Split(",", StringSplitOptions.RemoveEmptyEntries).ToList()
        );
        builder.Property(b => b.ImageUrl).HasColumnName("image_url").HasMaxLength(500);
        builder.Property(b => b.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(b => b.PublishedAt).HasColumnName("published_at");

        // REQ-055 (E7-S4): optional content language (ISO 639-1; null = default)
        builder.Property(b => b.ContentLanguage).HasColumnName("content_language").HasMaxLength(10);

        // Audit fields
        builder.Property(b => b.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(b => b.CreatedBy).HasColumnName("created_by");
        builder.Property(b => b.UpdatedAt).HasColumnName("updated_at");
        builder.Property(b => b.UpdatedBy).HasColumnName("updated_by");
        builder.Property(b => b.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false).IsRequired();
        builder.Property(b => b.DeletedAt).HasColumnName("deleted_at");
        builder.Property(b => b.DeletedBy).HasColumnName("deleted_by");

        builder.HasIndex(b => b.Slug).IsUnique().HasDatabaseName("ix_blog_posts_slug");
        builder.HasIndex(b => b.Status).HasDatabaseName("ix_blog_posts_status");
        builder.HasIndex(b => b.PublishedAt).HasDatabaseName("ix_blog_posts_published_at");

        builder.HasQueryFilter(b => !b.IsDeleted);
        builder.Ignore(b => b.DomainEvents);
    }
}
