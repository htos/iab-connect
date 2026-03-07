using System.Globalization;
using System.Text;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance.Exports.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Reporting;

/// <summary>
/// REQ-051: Exports all members as CSV with defined columns.
/// </summary>
public sealed class ExportMembersQueryHandler : IRequestHandler<ExportMembersQuery, ExportFileResult>
{
    private readonly IMemberRepository _memberRepository;
    private readonly IAuditService _auditService;

    public ExportMembersQueryHandler(
        IMemberRepository memberRepository,
        IAuditService auditService)
    {
        _memberRepository = memberRepository;
        _auditService = auditService;
    }

    public async Task<ExportFileResult> Handle(ExportMembersQuery request, CancellationToken ct)
    {
        var members = await _memberRepository.GetAllAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("Id;FirstName;LastName;Email;Phone;Status;Type;MemberSince;Street;City;PostalCode;Country");

        foreach (var m in members.OrderBy(m => m.LastName).ThenBy(m => m.FirstName))
        {
            sb.AppendLine(string.Join(";",
                m.Id,
                EscapeCsv(m.FirstName),
                EscapeCsv(m.LastName),
                EscapeCsv(m.Email),
                EscapeCsv(m.Phone),
                m.Status.ToString(),
                m.MembershipType.ToString(),
                m.MemberSince.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                EscapeCsv(m.Address.Street),
                EscapeCsv(m.Address.City),
                EscapeCsv(m.Address.PostalCode),
                EscapeCsv(m.Address.Country)));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"members_{DateTime.UtcNow:yyyyMMdd}.csv";

        await _auditService.LogActionAsync(
            AuditEventType.DataExported,
            $"Member list exported ({members.Count} records)",
            entityType: "Member",
            ct: ct);

        return new ExportFileResult(bytes, "text/csv", fileName);
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(';') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
