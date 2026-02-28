using FluentAssertions;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.DunningNotices.Queries;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for GetDunningNoticesQuery with InvoiceId filter (REQ-042)
/// </summary>
public class GetDunningNoticesQueryHandlerTests
{
    private readonly Mock<IDunningNoticeRepository> _dunningRepo = new();
    private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
    private readonly GetDunningNoticesQueryHandler _handler;

    public GetDunningNoticesQueryHandlerTests()
    {
        _handler = new GetDunningNoticesQueryHandler(_dunningRepo.Object, _invoiceRepo.Object);
    }

    [Fact]
    public async Task Handle_WithoutFilter_ShouldReturnAllNotices()
    {
        // Arrange
        var invoiceId = Guid.NewGuid();
        var notices = new List<DunningNotice>
        {
            DunningNotice.Create(invoiceId, 1, DateTime.UtcNow.AddDays(14), "First reminder", "admin"),
            DunningNotice.Create(Guid.NewGuid(), 2, DateTime.UtcNow.AddDays(14), "Second reminder", "admin")
        };
        _dunningRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(notices);
        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid id, CancellationToken _) =>
            {
                var inv = Invoice.Create("INV-001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
                    RecipientType.Member, null, "Test", null, 0m, null, "admin");
                return inv;
            });

        // Act
        var result = await _handler.Handle(new GetDunningNoticesQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(2);
        _dunningRepo.Verify(r => r.GetAllAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WithInvoiceIdFilter_ShouldReturnFilteredNotices()
    {
        // Arrange
        var invoiceId = Guid.NewGuid();
        var filteredNotices = new List<DunningNotice>
        {
            DunningNotice.Create(invoiceId, 1, DateTime.UtcNow.AddDays(14), "First reminder", "admin")
        };
        _dunningRepo.Setup(r => r.GetByInvoiceIdAsync(invoiceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(filteredNotices);
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoiceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid id, CancellationToken _) =>
            {
                var inv = Invoice.Create("INV-001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
                    RecipientType.Member, null, "Test", null, 0m, null, "admin");
                return inv;
            });

        // Act
        var result = await _handler.Handle(new GetDunningNoticesQuery(invoiceId), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(1);
        _dunningRepo.Verify(r => r.GetByInvoiceIdAsync(invoiceId, It.IsAny<CancellationToken>()), Times.Once);
        _dunningRepo.Verify(r => r.GetAllAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WithInvoiceIdFilter_NoMatches_ShouldReturnEmpty()
    {
        // Arrange
        var invoiceId = Guid.NewGuid();
        _dunningRepo.Setup(r => r.GetByInvoiceIdAsync(invoiceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<DunningNotice>());

        // Act
        var result = await _handler.Handle(new GetDunningNoticesQuery(invoiceId), CancellationToken.None);

        // Assert
        result.Items.Should().BeEmpty();
    }
}
