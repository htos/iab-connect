using System.Text;
using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance.Budgets.Queries;
using IabConnect.Domain.Audit;
using MediatR;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance.Budgets;

/// <summary>
/// REQ-044 (E6-S3) AC-4: the budget-vs-actual CSV export emits the header + a row per cost center
/// and audits a <see cref="AuditEventType.FinanceExported"/> event. Returns null when the period
/// does not exist (endpoint → 404).
/// </summary>
public class ExportBudgetVsActualTests
{
    private static readonly Guid PeriodId = Guid.NewGuid();

    private static BudgetVsActualReportDto Report() => new(
        PeriodId, "2026-01", 2026, 1,
        new[]
        {
            new BudgetVsActualRow(Guid.NewGuid(), "EVT", "Events", 1000m, 500m, 500m, 50m, "CHF"),
        });

    [Fact]
    public async Task Export_Emits_Header_Row_And_Audits()
    {
        var sender = new Mock<ISender>();
        var audit = new Mock<IAuditService>();
        sender.Setup(s => s.Send(It.IsAny<GetBudgetVsActualQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Report());

        var handler = new ExportBudgetVsActualQueryHandler(sender.Object, audit.Object);

        var result = await handler.Handle(new ExportBudgetVsActualQuery(PeriodId, null), CancellationToken.None);

        result.Should().NotBeNull();
        result!.ContentType.Should().Be("text/csv");
        result.FileName.Should().Contain("budget-vs-actual");

        var csv = Encoding.UTF8.GetString(result.Content);
        csv.Should().Contain("CostCenterCode;CostCenterName;FiscalPeriod;Budget;Actual;Variance;VariancePercent;Currency");
        csv.Should().Contain("EVT;Events;2026-01;1000.00;500.00;500.00;50.00;CHF");

        audit.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceExported, It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string?>(),
            "Budget", It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Export_UnknownPeriod_ReturnsNull_NoAudit()
    {
        var sender = new Mock<ISender>();
        var audit = new Mock<IAuditService>();
        sender.Setup(s => s.Send(It.IsAny<GetBudgetVsActualQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((BudgetVsActualReportDto?)null);

        var handler = new ExportBudgetVsActualQueryHandler(sender.Object, audit.Object);

        var result = await handler.Handle(new ExportBudgetVsActualQuery(Guid.NewGuid(), null), CancellationToken.None);

        result.Should().BeNull();
        audit.Verify(a => a.LogActionAsync(
            It.IsAny<AuditEventType>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
