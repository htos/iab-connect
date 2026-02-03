namespace IabConnect.Application.Tests.Communication;

using IabConnect.Domain.Communication;
using Xunit;

public class EmailTemplateTests
{
    [Fact]
    public void Create_WithValidData_CreatesTemplate()
    {
        // Arrange
        var name = "Welcome Email";
        var subject = "Welcome to {{organizationName}}";
        var htmlContent = "<p>Hello {{name}},</p>";
        var textContent = "Hello {{name}},";
        var category = "Welcome";

        // Act
        var template = EmailTemplate.Create(name, subject, htmlContent, textContent, category);

        // Assert
        Assert.NotNull(template);
        Assert.Equal(name, template.Name);
        Assert.Equal(subject, template.Subject);
        Assert.Equal(category, template.Category);
        Assert.True(template.IsActive);
        Assert.Equal(1, template.Version);
    }

    [Fact]
    public void Create_WithEmptyName_ThrowsException()
    {
        // Act & Assert
        Assert.Throws<ArgumentException>(() =>
            EmailTemplate.Create("", "Subject", "<p>Content</p>", "Content", "Test")
        );
    }

    [Fact]
    public void Update_IncrementsVersion()
    {
        // Arrange
        var template = EmailTemplate.Create("Test", "Subject", "<p>Content</p>", "Content", "Test");
        var initialVersion = template.Version;

        // Act
        template.Update("Updated", "New Subject", "<p>New</p>", "New", "Test", "");

        // Assert
        Assert.Equal(initialVersion + 1, template.Version);
    }

    [Fact]
    public void RenderHtml_ReplacesVariables()
    {
        // Arrange
        var template = EmailTemplate.Create(
            "Test",
            "Hello {{name}}",
            "<p>Hello {{name}}, welcome to {{organizationName}}</p>",
            "Content",
            "Test"
        );
        var variables = new Dictionary<string, string>
        {
            { "name", "John" },
            { "organizationName", "IAB Connect" }
        };

        // Act
        var result = template.RenderHtml(variables);

        // Assert
        Assert.Contains("John", result);
        Assert.Contains("IAB Connect", result);
        Assert.DoesNotContain("{{name}}", result);
    }

    [Fact]
    public void RenderSubject_ReplacesVariables()
    {
        // Arrange
        var template = EmailTemplate.Create(
            "Test",
            "Hello {{name}}, from {{organizationName}}",
            "<p>Content</p>",
            "Content",
            "Test"
        );
        var variables = new Dictionary<string, string>
        {
            { "name", "Alice" },
            { "organizationName", "IAB" }
        };

        // Act
        var result = template.RenderSubject(variables);

        // Assert
        Assert.Equal("Hello Alice, from IAB", result);
    }

    [Fact]
    public void AddVariable_AddsToVariablesList()
    {
        // Arrange
        var template = EmailTemplate.Create("Test", "Subject", "<p>Content</p>", "Content", "Test");

        // Act
        template.Variables.Add(new EmailTemplateVariable
        {
            Name = "name",
            Description = "User name",
            IsRequired = true
        });

        // Assert
        Assert.Single(template.Variables);
        Assert.Equal("name", template.Variables.First().Name);
    }
}
