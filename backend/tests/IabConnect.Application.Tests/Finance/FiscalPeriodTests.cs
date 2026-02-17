using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for FiscalPeriod domain entity (REQ-066)
/// </summary>
public class FiscalPeriodTests
{
    private static FiscalPeriod CreateOpenPeriod(int year = 2026, int month = 1)
    {
        var startDate = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var endDate = new DateTime(year, month, DateTime.DaysInMonth(year, month), 23, 59, 59, DateTimeKind.Utc);
        return FiscalPeriod.Create(year, month, startDate, endDate);
    }

    private static FiscalPeriod CreateLockedPeriod()
    {
        var period = CreateOpenPeriod();
        period.Lock("admin", "Year-end close");
        return period;
    }

    private static FiscalPeriod CreateClosedPeriod()
    {
        var period = CreateOpenPeriod();
        period.Close("admin", 1000m, 500m, "Soft close");
        return period;
    }

    #region FiscalPeriod_Create

    [Fact]
    public void Should_Create_FiscalPeriod_With_Valid_Data()
    {
        // Arrange
        var startDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var endDate = new DateTime(2026, 1, 31, 23, 59, 59, DateTimeKind.Utc);

        // Act
        var period = FiscalPeriod.Create(2026, 1, startDate, endDate);

        // Assert
        period.Should().NotBeNull();
        period.Id.Should().NotBe(Guid.Empty);
        period.Year.Should().Be(2026);
        period.Month.Should().Be(1);
        period.StartDate.Should().Be(startDate);
        period.EndDate.Should().Be(endDate);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    public void Should_Throw_When_Month_OutOfRange(int month)
    {
        // Arrange
        var startDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var endDate = new DateTime(2026, 1, 31, 23, 59, 59, DateTimeKind.Utc);

        // Act
        var act = () => FiscalPeriod.Create(2026, month, startDate, endDate);

        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("month");
    }

    [Fact]
    public void Should_Throw_When_EndDate_Before_StartDate()
    {
        // Arrange
        var startDate = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc);
        var endDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var act = () => FiscalPeriod.Create(2026, 1, startDate, endDate);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("endDate");
    }

    [Fact]
    public void Should_Set_Status_To_Open_By_Default()
    {
        // Act
        var period = CreateOpenPeriod();

        // Assert
        period.Status.Should().Be(FiscalPeriodStatus.Open);
    }

    [Fact]
    public void Should_Set_Name_Format_Correctly()
    {
        // Act
        var period = CreateOpenPeriod(2026, 1);

        // Assert
        period.Name.Should().Be("2026-01");
    }

    [Fact]
    public void Should_Set_UTC_Dates()
    {
        // Arrange
        var startDate = new DateTime(2026, 3, 1);
        var endDate = new DateTime(2026, 3, 31);

        // Act
        var period = FiscalPeriod.Create(2026, 3, startDate, endDate);

        // Assert
        period.StartDate.Kind.Should().Be(DateTimeKind.Utc);
        period.EndDate.Kind.Should().Be(DateTimeKind.Utc);
        period.CreatedAt.Offset.Should().Be(TimeSpan.Zero);
        period.UpdatedAt.Offset.Should().Be(TimeSpan.Zero);
    }

    #endregion

    #region FiscalPeriod_Lock

    [Fact]
    public void Should_Lock_Period_Successfully()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        period.Lock("admin");

        // Assert
        period.Status.Should().Be(FiscalPeriodStatus.Locked);
    }

    [Fact]
    public void Should_Set_LockedAt_And_LockedBy_On_Lock()
    {
        // Arrange
        var period = CreateOpenPeriod();
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        period.Lock("admin");

        // Assert
        period.LockedAt.Should().NotBeNull();
        period.LockedAt.Should().BeAfter(before);
        period.LockedBy.Should().Be("admin");
    }

    [Fact]
    public void Should_Set_LockNotes_On_Lock()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        period.Lock("admin", "Year-end close");

        // Assert
        period.LockNotes.Should().Be("Year-end close");
    }

    [Fact]
    public void Should_Throw_When_Locking_Already_Locked_Period()
    {
        // Arrange
        var period = CreateLockedPeriod();

        // Act
        var act = () => period.Lock("admin");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*already locked*");
    }

    [Fact]
    public void Should_Throw_When_LockedBy_IsEmpty()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        var act = () => period.Lock("");

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("lockedBy");
    }

    #endregion

    #region FiscalPeriod_Unlock

    [Fact]
    public void Should_Unlock_Period_Successfully()
    {
        // Arrange
        var period = CreateLockedPeriod();

        // Act
        period.Unlock("admin");

        // Assert
        period.Status.Should().Be(FiscalPeriodStatus.Open);
    }

    [Fact]
    public void Should_Set_UnlockedAt_And_UnlockedBy_On_Unlock()
    {
        // Arrange
        var period = CreateLockedPeriod();
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        period.Unlock("admin");

        // Assert
        period.UnlockedAt.Should().NotBeNull();
        period.UnlockedAt.Should().BeAfter(before);
        period.UnlockedBy.Should().Be("admin");
    }

    [Fact]
    public void Should_Throw_When_Unlocking_Non_Locked_Period()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        var act = () => period.Unlock("admin");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*not locked*");
    }

    [Fact]
    public void Should_Throw_When_UnlockedBy_IsEmpty()
    {
        // Arrange
        var period = CreateLockedPeriod();

        // Act
        var act = () => period.Unlock("");

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("unlockedBy");
    }

    #endregion

    #region FiscalPeriod_Close

    [Fact]
    public void Should_Close_Period_Successfully()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        period.Close("admin", 1500m, 800m);

        // Assert
        period.Status.Should().Be(FiscalPeriodStatus.Closed);
    }

    [Fact]
    public void Should_Throw_When_Closing_Locked_Period()
    {
        // Arrange
        var period = CreateLockedPeriod();

        // Act
        var act = () => period.Close("admin", 0m, 0m);

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*locked*");
    }

    [Fact]
    public void Should_Throw_When_ClosedBy_IsEmpty()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        var act = () => period.Close("", 0m, 0m);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("closedBy");
    }

    #endregion

    #region FiscalPeriod_Close_Balance_CarryForward

    [Fact]
    public void Should_Store_Totals_On_Close()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        period.Close("admin", 5000m, 3000m);

        // Assert
        period.TotalIncome.Should().Be(5000m);
        period.TotalExpense.Should().Be(3000m);
        period.ClosingBalance.Should().Be(2000m);
    }

    [Fact]
    public void Should_Handle_Zero_Totals_On_Close()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        period.Close("admin", 0m, 0m);

        // Assert
        period.TotalIncome.Should().Be(0m);
        period.TotalExpense.Should().Be(0m);
        period.ClosingBalance.Should().Be(0m);
    }

    [Fact]
    public void Should_Handle_Negative_Balance_On_Close()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        period.Close("admin", 1000m, 2500m);

        // Assert
        period.ClosingBalance.Should().Be(-1500m);
    }

    #endregion

    #region FiscalPeriod_Reopen_Clears_Balance

    [Fact]
    public void Should_Clear_Totals_On_Reopen()
    {
        // Arrange
        var period = CreateClosedPeriod();
        period.TotalIncome.Should().Be(1000m); // from CreateClosedPeriod()

        // Act
        period.Reopen("admin");

        // Assert
        period.TotalIncome.Should().BeNull();
        period.TotalExpense.Should().BeNull();
        period.ClosingBalance.Should().BeNull();
    }

    #endregion

    #region FiscalPeriod_Reopen

    [Fact]
    public void Should_Reopen_Closed_Period_Successfully()
    {
        // Arrange
        var period = CreateClosedPeriod();

        // Act
        period.Reopen("admin");

        // Assert
        period.Status.Should().Be(FiscalPeriodStatus.Open);
    }

    [Fact]
    public void Should_Throw_When_Reopening_Non_Closed_Period()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act
        var act = () => period.Reopen("admin");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*closed*");
    }

    #endregion

    #region FiscalPeriod_ContainsDate

    [Fact]
    public void Should_Return_True_For_Date_Within_Period()
    {
        // Arrange
        var period = CreateOpenPeriod(2026, 1);
        var date = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        // Act & Assert
        period.ContainsDate(date).Should().BeTrue();
    }

    [Fact]
    public void Should_Return_False_For_Date_Outside_Period()
    {
        // Arrange
        var period = CreateOpenPeriod(2026, 1);
        var date = new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc);

        // Act & Assert
        period.ContainsDate(date).Should().BeFalse();
    }

    [Fact]
    public void Should_Return_True_For_Start_Date()
    {
        // Arrange
        var period = CreateOpenPeriod(2026, 1);
        var date = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        // Act & Assert
        period.ContainsDate(date).Should().BeTrue();
    }

    [Fact]
    public void Should_Return_True_For_End_Date()
    {
        // Arrange
        var period = CreateOpenPeriod(2026, 1);
        var date = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc);

        // Act & Assert
        period.ContainsDate(date).Should().BeTrue();
    }

    #endregion

    #region FiscalPeriod_IsMutationAllowed

    [Fact]
    public void Should_Return_True_When_Open()
    {
        // Arrange
        var period = CreateOpenPeriod();

        // Act & Assert
        period.IsMutationAllowed.Should().BeTrue();
    }

    [Fact]
    public void Should_Return_True_When_Closed()
    {
        // Arrange
        var period = CreateClosedPeriod();

        // Act & Assert
        period.IsMutationAllowed.Should().BeTrue();
    }

    [Fact]
    public void Should_Return_False_When_Locked()
    {
        // Arrange
        var period = CreateLockedPeriod();

        // Act & Assert
        period.IsMutationAllowed.Should().BeFalse();
    }

    #endregion
}
