using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.FiscalPeriods;
using IabConnect.Application.Finance.FiscalPeriods.Commands;
using IabConnect.Application.Finance.FiscalPeriods.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for FiscalPeriod command/query handlers (REQ-066)
/// </summary>
public class FiscalPeriodHandlerTests
{
    private readonly Mock<IFiscalPeriodRepository> _periodRepo = new();
    private readonly Mock<IFinanceProfileRepository> _profileRepo = new();
    private readonly Mock<ITransactionRepository> _transactionRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();

    private static FiscalPeriod CreatePeriod(int year = 2026, int month = 1)
    {
        var startDate = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var endDate = new DateTime(year, month, DateTime.DaysInMonth(year, month), 23, 59, 59, DateTimeKind.Utc);
        return FiscalPeriod.Create(year, month, startDate, endDate);
    }

    private static FinanceProfile CreateActiveProfile(int fiscalYearStartMonth = 1)
    {
        return FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, fiscalYearStartMonth,
            "Verein", "Address", "Bern", "3000", "CH",
            null, null, null, null, null, null, null);
    }

    #region GenerateFiscalPeriodsCommandHandler

    [Fact]
    public async Task Generate_Should_Generate_12_Periods_For_Calendar_Year()
    {
        // Arrange
        var profile = CreateActiveProfile(fiscalYearStartMonth: 1);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);
        _periodRepo.Setup(r => r.GetAllAsync(2026, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<FiscalPeriod>());

        // After save, return all 12 newly created periods
        var generatedPeriods = Enumerable.Range(1, 12)
            .Select(m => CreatePeriod(2026, m)).ToList();
        _periodRepo.SetupSequence(r => r.GetAllAsync(2026, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<FiscalPeriod>())   // first call: no existing
            .ReturnsAsync(generatedPeriods);           // second call: after save

        var handler = new GenerateFiscalPeriodsCommandHandler(
            _periodRepo.Object, _profileRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new GenerateFiscalPeriodsCommand { Year = 2026, UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().HaveCount(12);
        _periodRepo.Verify(r => r.AddRangeAsync(
            It.Is<IEnumerable<FiscalPeriod>>(p => p.Count() == 12),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Generate_Should_Generate_12_Periods_For_NonCalendar_Year()
    {
        // Arrange — fiscal year starts in April
        var profile = CreateActiveProfile(fiscalYearStartMonth: 4);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        // Build expected months: April(4)..Dec(12) in 2026, Jan(1)..March(3) in 2027
        var expectedMonths = new List<(int year, int month)>();
        for (int i = 0; i < 12; i++)
        {
            var m = ((4 - 1 + i) % 12) + 1;
            var y = 2026 + ((4 - 1 + i) / 12);
            expectedMonths.Add((y, m));
        }

        var allPeriods = expectedMonths.Select(e => CreatePeriod(e.year, e.month)).ToList();

        _periodRepo.SetupSequence(r => r.GetAllAsync(2026, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<FiscalPeriod>())
            .ReturnsAsync(allPeriods);

        var handler = new GenerateFiscalPeriodsCommandHandler(
            _periodRepo.Object, _profileRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new GenerateFiscalPeriodsCommand { Year = 2026, UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().HaveCount(12);
        _periodRepo.Verify(r => r.AddRangeAsync(
            It.Is<IEnumerable<FiscalPeriod>>(p => p.Count() == 12),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Generate_Should_Skip_Existing_Periods()
    {
        // Arrange
        var profile = CreateActiveProfile(fiscalYearStartMonth: 1);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        // 6 periods already exist (Jan–Jun)
        var existingPeriods = Enumerable.Range(1, 6)
            .Select(m => CreatePeriod(2026, m)).ToList();

        var allPeriods = Enumerable.Range(1, 12)
            .Select(m => CreatePeriod(2026, m)).ToList();

        _periodRepo.SetupSequence(r => r.GetAllAsync(2026, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingPeriods)
            .ReturnsAsync(allPeriods);

        var handler = new GenerateFiscalPeriodsCommandHandler(
            _periodRepo.Object, _profileRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new GenerateFiscalPeriodsCommand { Year = 2026, UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().HaveCount(12);
        _periodRepo.Verify(r => r.AddRangeAsync(
            It.Is<IEnumerable<FiscalPeriod>>(p => p.Count() == 6),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Generate_Should_Throw_When_No_Active_Profile()
    {
        // Arrange
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((FinanceProfile?)null);

        var handler = new GenerateFiscalPeriodsCommandHandler(
            _periodRepo.Object, _profileRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new GenerateFiscalPeriodsCommand { Year = 2026, UserName = "admin" };

        // Act
        var act = () => handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No active finance profile*");
    }

    #endregion

    #region LockFiscalPeriodCommandHandler

    [Fact]
    public async Task Lock_Should_Lock_Period_Successfully()
    {
        // Arrange
        var period = CreatePeriod();
        var periodId = period.Id;

        _periodRepo.Setup(r => r.GetByIdAsync(periodId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var handler = new LockFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new LockFiscalPeriodCommand { Id = periodId, UserName = "admin", Notes = "Test lock" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Status.Should().Be("Locked");
        _periodRepo.Verify(r => r.UpdateAsync(period, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Lock_Should_Return_Null_When_Period_Not_Found()
    {
        // Arrange
        _periodRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((FiscalPeriod?)null);

        var handler = new LockFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new LockFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().BeNull();
        _periodRepo.Verify(r => r.UpdateAsync(It.IsAny<FiscalPeriod>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Lock_Should_Audit_Lock_Action()
    {
        // Arrange
        var period = CreatePeriod();
        _periodRepo.Setup(r => r.GetByIdAsync(period.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var handler = new LockFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new LockFiscalPeriodCommand { Id = period.Id, UserName = "admin" };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("Locked")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "FiscalPeriod",
            period.Id.ToString(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region UnlockFiscalPeriodCommandHandler

    [Fact]
    public async Task Unlock_Should_Unlock_Period_Successfully()
    {
        // Arrange
        var period = CreatePeriod();
        period.Lock("admin");
        var periodId = period.Id;

        _periodRepo.Setup(r => r.GetByIdAsync(periodId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var handler = new UnlockFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new UnlockFiscalPeriodCommand { Id = periodId, UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Status.Should().Be("Open");
        _periodRepo.Verify(r => r.UpdateAsync(period, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Unlock_Should_Return_Null_When_Period_Not_Found()
    {
        // Arrange
        _periodRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((FiscalPeriod?)null);

        var handler = new UnlockFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new UnlockFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().BeNull();
        _periodRepo.Verify(r => r.UpdateAsync(It.IsAny<FiscalPeriod>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Unlock_Should_Audit_Unlock_Action()
    {
        // Arrange
        var period = CreatePeriod();
        period.Lock("admin");
        _periodRepo.Setup(r => r.GetByIdAsync(period.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var handler = new UnlockFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new UnlockFiscalPeriodCommand { Id = period.Id, UserName = "admin" };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("Unlocked")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "FiscalPeriod",
            period.Id.ToString(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region CloseFiscalPeriodCommandHandler

    [Fact]
    public async Task Close_Should_Close_Period_With_Calculated_Totals()
    {
        // Arrange
        var period = CreatePeriod();
        var periodId = period.Id;

        _periodRepo.Setup(r => r.GetByIdAsync(periodId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);
        _transactionRepo.Setup(r => r.GetSummaryAsync(
                period.StartDate, period.EndDate, It.IsAny<CancellationToken>()))
            .ReturnsAsync((5000m, 3000m));

        var handler = new CloseFiscalPeriodCommandHandler(
            _periodRepo.Object, _transactionRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new CloseFiscalPeriodCommand { Id = periodId, UserName = "admin", Notes = "Month-end close" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Status.Should().Be("Closed");
        result.TotalIncome.Should().Be(5000m);
        result.TotalExpense.Should().Be(3000m);
        result.ClosingBalance.Should().Be(2000m);
        _periodRepo.Verify(r => r.UpdateAsync(period, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Close_Should_Return_Null_When_Period_Not_Found()
    {
        // Arrange
        _periodRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((FiscalPeriod?)null);

        var handler = new CloseFiscalPeriodCommandHandler(
            _periodRepo.Object, _transactionRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new CloseFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().BeNull();
        _periodRepo.Verify(r => r.UpdateAsync(It.IsAny<FiscalPeriod>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Close_Should_Throw_When_Period_Is_Locked()
    {
        // Arrange
        var period = CreatePeriod();
        period.Lock("admin");

        _periodRepo.Setup(r => r.GetByIdAsync(period.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);
        _transactionRepo.Setup(r => r.GetSummaryAsync(
                It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((0m, 0m));

        var handler = new CloseFiscalPeriodCommandHandler(
            _periodRepo.Object, _transactionRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new CloseFiscalPeriodCommand { Id = period.Id, UserName = "admin" };

        // Act
        var act = () => handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*locked*");
    }

    [Fact]
    public async Task Close_Should_Handle_Zero_Transactions()
    {
        // Arrange
        var period = CreatePeriod();

        _periodRepo.Setup(r => r.GetByIdAsync(period.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);
        _transactionRepo.Setup(r => r.GetSummaryAsync(
                period.StartDate, period.EndDate, It.IsAny<CancellationToken>()))
            .ReturnsAsync((0m, 0m));

        var handler = new CloseFiscalPeriodCommandHandler(
            _periodRepo.Object, _transactionRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new CloseFiscalPeriodCommand { Id = period.Id, UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.TotalIncome.Should().Be(0m);
        result.TotalExpense.Should().Be(0m);
        result.ClosingBalance.Should().Be(0m);
    }

    [Fact]
    public async Task Close_Should_Audit_Close_Action()
    {
        // Arrange
        var period = CreatePeriod();
        _periodRepo.Setup(r => r.GetByIdAsync(period.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);
        _transactionRepo.Setup(r => r.GetSummaryAsync(
                It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((1000m, 500m));

        var handler = new CloseFiscalPeriodCommandHandler(
            _periodRepo.Object, _transactionRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new CloseFiscalPeriodCommand { Id = period.Id, UserName = "admin" };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("Closed")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "FiscalPeriod",
            period.Id.ToString(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region ReopenFiscalPeriodCommandHandler

    [Fact]
    public async Task Reopen_Should_Reopen_Closed_Period()
    {
        // Arrange
        var period = CreatePeriod();
        period.Close("admin", 5000m, 3000m);
        var periodId = period.Id;

        _periodRepo.Setup(r => r.GetByIdAsync(periodId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var handler = new ReopenFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new ReopenFiscalPeriodCommand { Id = periodId, UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Status.Should().Be("Open");
        result.TotalIncome.Should().BeNull();
        result.TotalExpense.Should().BeNull();
        result.ClosingBalance.Should().BeNull();
        _periodRepo.Verify(r => r.UpdateAsync(period, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Reopen_Should_Return_Null_When_Period_Not_Found()
    {
        // Arrange
        _periodRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((FiscalPeriod?)null);

        var handler = new ReopenFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new ReopenFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "admin" };

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().BeNull();
        _periodRepo.Verify(r => r.UpdateAsync(It.IsAny<FiscalPeriod>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Reopen_Should_Throw_When_Period_Is_Not_Closed()
    {
        // Arrange
        var period = CreatePeriod(); // Open period

        _periodRepo.Setup(r => r.GetByIdAsync(period.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var handler = new ReopenFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new ReopenFiscalPeriodCommand { Id = period.Id, UserName = "admin" };

        // Act
        var act = () => handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*closed*");
    }

    [Fact]
    public async Task Reopen_Should_Audit_Reopen_Action()
    {
        // Arrange
        var period = CreatePeriod();
        period.Close("admin", 1000m, 500m);

        _periodRepo.Setup(r => r.GetByIdAsync(period.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var handler = new ReopenFiscalPeriodCommandHandler(
            _periodRepo.Object, _unitOfWork.Object, _auditService.Object);

        var command = new ReopenFiscalPeriodCommand { Id = period.Id, UserName = "admin" };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("Reopened")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "FiscalPeriod",
            period.Id.ToString(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region GetFiscalPeriodsQueryHandler

    [Fact]
    public async Task GetAll_Should_Return_All_Periods()
    {
        // Arrange
        var periods = Enumerable.Range(1, 12)
            .Select(m => CreatePeriod(2026, m)).ToList();

        _periodRepo.Setup(r => r.GetAllAsync(null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(periods);

        var handler = new GetFiscalPeriodsQueryHandler(_periodRepo.Object);

        // Act
        var result = await handler.Handle(new GetFiscalPeriodsQuery(), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(12);
    }

    [Fact]
    public async Task GetAll_Should_Filter_By_Year()
    {
        // Arrange
        var periods = Enumerable.Range(1, 6)
            .Select(m => CreatePeriod(2026, m)).ToList();

        _periodRepo.Setup(r => r.GetAllAsync(2026, It.IsAny<CancellationToken>()))
            .ReturnsAsync(periods);

        var handler = new GetFiscalPeriodsQueryHandler(_periodRepo.Object);

        // Act
        var result = await handler.Handle(new GetFiscalPeriodsQuery(2026), CancellationToken.None);

        // Assert
        result.Items.Should().HaveCount(6);
        result.Items.Should().OnlyContain(p => p.Year == 2026);
    }

    #endregion

    #region FiscalPeriodService

    [Fact]
    public async Task Service_Should_Throw_When_Period_Is_Locked()
    {
        // Arrange
        var period = CreatePeriod();
        period.Lock("admin");

        var date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);
        _periodRepo.Setup(r => r.GetByDateAsync(date, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var service = new FiscalPeriodService(_periodRepo.Object);

        // Act
        var act = () => service.EnsurePeriodNotLockedAsync(date);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*locked*");
    }

    [Fact]
    public async Task Service_Should_Not_Throw_When_Period_Is_Open()
    {
        // Arrange
        var period = CreatePeriod();
        var date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        _periodRepo.Setup(r => r.GetByDateAsync(date, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var service = new FiscalPeriodService(_periodRepo.Object);

        // Act
        var act = () => service.EnsurePeriodNotLockedAsync(date);

        // Assert
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Service_Should_Not_Throw_When_No_Period_Exists()
    {
        // Arrange
        var date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);
        _periodRepo.Setup(r => r.GetByDateAsync(date, It.IsAny<CancellationToken>()))
            .ReturnsAsync((FiscalPeriod?)null);

        var service = new FiscalPeriodService(_periodRepo.Object);

        // Act
        var act = () => service.EnsurePeriodNotLockedAsync(date);

        // Assert
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Service_Should_Return_True_When_Period_Is_Locked()
    {
        // Arrange
        var period = CreatePeriod();
        period.Lock("admin");

        var date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);
        _periodRepo.Setup(r => r.GetByDateAsync(date, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var service = new FiscalPeriodService(_periodRepo.Object);

        // Act
        var result = await service.IsPeriodLockedAsync(date, CancellationToken.None);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task Service_Should_Return_False_When_Period_Is_Open()
    {
        // Arrange
        var period = CreatePeriod();
        var date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        _periodRepo.Setup(r => r.GetByDateAsync(date, It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        var service = new FiscalPeriodService(_periodRepo.Object);

        // Act
        var result = await service.IsPeriodLockedAsync(date, CancellationToken.None);

        // Assert
        result.Should().BeFalse();
    }

    #endregion
}
