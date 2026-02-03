namespace IabConnect.Api.Endpoints;

using IabConnect.Application.Communication;
using IabConnect.Domain.Communication;
using IabConnect.Api.DTOs;

public static class EmailTemplateEndpoints
{
    public static void MapEmailTemplateEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/email-templates")
            .WithTags("Email Templates")
            .RequireAuthorization();

        group.MapGet("/", GetAllTemplates)
            .WithName("GetEmailTemplates")
            .Produces<List<EmailTemplateDto>>(StatusCodes.Status200OK);

        group.MapGet("/{id}", GetTemplateById)
            .WithName("GetEmailTemplateById")
            .Produces<EmailTemplateDto>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        group.MapGet("/category/{category}", GetTemplatesByCategory)
            .WithName("GetEmailTemplatesByCategory")
            .Produces<List<EmailTemplateDto>>(StatusCodes.Status200OK);

        group.MapPost("/", CreateTemplate)
            .WithName("CreateEmailTemplate")
            .Produces<EmailTemplateDto>(StatusCodes.Status201Created);

        group.MapPut("/{id}", UpdateTemplate)
            .WithName("UpdateEmailTemplate")
            .Produces<EmailTemplateDto>(StatusCodes.Status200OK);

        group.MapDelete("/{id}", DeleteTemplate)
            .WithName("DeleteEmailTemplate")
            .Produces(StatusCodes.Status204NoContent);

        group.MapPost("/{id}/preview", PreviewTemplate)
            .WithName("PreviewEmailTemplate")
            .Produces<PreviewTemplateResponse>(StatusCodes.Status200OK);

        group.MapPost("/{id}/deactivate", DeactivateTemplate)
            .WithName("DeactivateEmailTemplate")
            .Produces<EmailTemplateDto>(StatusCodes.Status200OK);
    }

    private static async Task<IResult> GetAllTemplates(IEmailTemplateRepository repository)
    {
        var templates = await repository.GetAllAsync();
        return Results.Ok(templates.Select(MapToDto));
    }

    private static async Task<IResult> GetTemplateById(int id, IEmailTemplateRepository repository)
    {
        var template = await repository.GetByIdAsync(id);
        if (template == null)
            return Results.NotFound();
        return Results.Ok(MapToDto(template));
    }

    private static async Task<IResult> GetTemplatesByCategory(string category, IEmailTemplateRepository repository)
    {
        var templates = await repository.GetByCategoryAsync(category);
        return Results.Ok(templates.Select(MapToDto));
    }

    private static async Task<IResult> CreateTemplate(CreateEmailTemplateRequest request, IEmailTemplateRepository repository)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Subject))
            return Results.BadRequest("Name and Subject are required");

        var existingTemplate = await repository.GetByNameAsync(request.Name);
        if (existingTemplate != null)
            return Results.BadRequest("Template with this name already exists");

        var template = EmailTemplate.Create(
            request.Name,
            request.Subject,
            request.HtmlContent,
            request.TextContent,
            request.Category,
            request.Description
        );

        if (request.Variables?.Any() == true)
        {
            foreach (var variable in request.Variables)
            {
                template.Variables.Add(new EmailTemplateVariable
                {
                    Name = variable.Name,
                    Description = variable.Description,
                    DefaultValue = variable.DefaultValue ?? "",
                    IsRequired = variable.IsRequired
                });
            }
        }

        var created = await repository.AddAsync(template);
        return Results.Created($"/api/v1/email-templates/{created.Id}", MapToDto(created));
    }

    private static async Task<IResult> UpdateTemplate(int id, UpdateEmailTemplateRequest request, IEmailTemplateRepository repository)
    {
        var template = await repository.GetByIdAsync(id);
        if (template == null)
            return Results.NotFound();

        template.Update(
            request.Name,
            request.Subject,
            request.HtmlContent,
            request.TextContent,
            request.Category,
            request.Description
        );

        template.Variables.Clear();
        if (request.Variables?.Any() == true)
        {
            foreach (var variable in request.Variables)
            {
                template.Variables.Add(new EmailTemplateVariable
                {
                    Name = variable.Name,
                    Description = variable.Description,
                    DefaultValue = variable.DefaultValue ?? "",
                    IsRequired = variable.IsRequired
                });
            }
        }

        await repository.UpdateAsync(template);
        return Results.Ok(MapToDto(template));
    }

    private static async Task<IResult> DeleteTemplate(int id, IEmailTemplateRepository repository)
    {
        var template = await repository.GetByIdAsync(id);
        if (template == null)
            return Results.NotFound();

        await repository.DeleteAsync(id);
        return Results.NoContent();
    }

    private static async Task<IResult> PreviewTemplate(int id, PreviewTemplateRequest request, IEmailTemplateRepository repository)
    {
        var template = await repository.GetByIdAsync(id);
        if (template == null)
            return Results.NotFound();

        var variables = request.Variables ?? new Dictionary<string, string>();
        var renderedHtml = template.RenderHtml(variables);
        var renderedSubject = template.RenderSubject(variables);

        return Results.Ok(new PreviewTemplateResponse(
            renderedSubject,
            renderedHtml
        ));
    }

    private static async Task<IResult> DeactivateTemplate(int id, IEmailTemplateRepository repository)
    {
        var template = await repository.GetByIdAsync(id);
        if (template == null)
            return Results.NotFound();

        template.IsActive = false;
        await repository.UpdateAsync(template);
        return Results.Ok(MapToDto(template));
    }

    private static EmailTemplateDto MapToDto(EmailTemplate template)
    {
        return new EmailTemplateDto
        {
            Id = template.Id,
            Name = template.Name,
            Subject = template.Subject,
            HtmlContent = template.HtmlContent,
            TextContent = template.TextContent,
            Category = template.Category,
            Description = template.Description,
            Version = template.Version,
            IsActive = template.IsActive,
            Variables = template.Variables.Select(v => new EmailTemplateVariableDto
            {
                Name = v.Name,
                Description = v.Description,
                DefaultValue = v.DefaultValue,
                IsRequired = v.IsRequired
            }).ToList()
        };
    }
}

public record CreateEmailTemplateRequest(
    string Name,
    string Subject,
    string HtmlContent,
    string TextContent,
    string Category,
    string Description = "",
    List<EmailTemplateVariableRequest>? Variables = null
);

public record UpdateEmailTemplateRequest(
    string Name,
    string Subject,
    string HtmlContent,
    string TextContent,
    string Category,
    string Description = "",
    List<EmailTemplateVariableRequest>? Variables = null
);

public record EmailTemplateVariableRequest(
    string Name,
    string Description = "",
    string? DefaultValue = null,
    bool IsRequired = false
);

public record PreviewTemplateRequest(
    Dictionary<string, string>? Variables = null
);

public record PreviewTemplateResponse(
    string Subject,
    string HtmlContent
);
