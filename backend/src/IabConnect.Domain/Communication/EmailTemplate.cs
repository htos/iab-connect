namespace IabConnect.Domain.Communication;

using IabConnect.Domain.Common;

public class EmailTemplate
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string HtmlContent { get; set; } = string.Empty;
    public string TextContent { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    public ICollection<EmailTemplateVariable> Variables { get; set; } = new List<EmailTemplateVariable>();

    public static EmailTemplate Create(string name, string subject, string htmlContent, string textContent, string category, string description = "")
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required");
        if (string.IsNullOrWhiteSpace(subject)) throw new ArgumentException("Subject is required");
        if (string.IsNullOrWhiteSpace(htmlContent)) throw new ArgumentException("HTML content is required");

        return new EmailTemplate
        {
            Name = name,
            Subject = subject,
            HtmlContent = htmlContent,
            TextContent = textContent,
            Category = category,
            Description = description,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Update(string name, string subject, string htmlContent, string textContent, string category, string description)
    {
        Name = name;
        Subject = subject;
        HtmlContent = htmlContent;
        TextContent = textContent;
        Category = category;
        Description = description;
        Version++;
        UpdatedAt = DateTime.UtcNow;
    }

    public string RenderHtml(Dictionary<string, string> variables)
    {
        var result = HtmlContent;
        foreach (var (key, value) in variables)
        {
            result = result.Replace($"{{{{{key}}}}}", value ?? "");
        }
        return result;
    }

    public string RenderSubject(Dictionary<string, string> variables)
    {
        var result = Subject;
        foreach (var (key, value) in variables)
        {
            result = result.Replace($"{{{{{key}}}}}", value ?? "");
        }
        return result;
    }
}

public class EmailTemplateVariable
{
    public int Id { get; set; }
    public int EmailTemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string DefaultValue { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
}
