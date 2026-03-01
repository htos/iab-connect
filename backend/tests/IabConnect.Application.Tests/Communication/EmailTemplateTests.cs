using FluentAssertions;
using IabConnect.Domain.Communication;
using Xunit;

namespace IabConnect.Application.Tests.Communication;

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
        template.Should().NotBeNull();
        template.Name.Should().Be(name);
        template.Subject.Should().Be(subject);
        template.Category.Should().Be(category);
        template.IsActive.Should().BeTrue();
        template.Version.Should().Be(1);
    }

    [Fact]
    public void Create_WithEmptyName_ThrowsException()
    {
        // Act & Assert
        var act = () => EmailTemplate.Create("", "Subject", "<p>Content</p>", "Content", "Test");
        act.Should().Throw<ArgumentException>();
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
        template.Version.Should().Be(initialVersion + 1);
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
        result.Should().Contain("John");
        result.Should().Contain("IAB Connect");
        result.Should().NotContain("{{name}}");
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
        result.Should().Be("Hello Alice, from IAB");
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
        template.Variables.Should().HaveCount(1);
        template.Variables.First().Name.Should().Be("name");
    }
}
