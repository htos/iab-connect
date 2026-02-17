using FluentAssertions;
using IabConnect.Application.Finance.BankImports.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// REQ-069: Validator tests for ImportCamtCommand.
/// </summary>
public class ImportCamtCommandValidatorTests
{
    private readonly ImportCamtCommandValidator _sut = new();

    private static ImportCamtCommand CreateValidCommand() => new()
    {
        FileName = "bank_statement.xml",
        FileStream = new MemoryStream(),
        UserName = "admin"
    };

    [Fact]
    public void Should_Pass_With_Valid_Input()
    {
        var command = CreateValidCommand();

        var result = _sut.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Should_Fail_When_FileName_Empty()
    {
        var command = CreateValidCommand() with { FileName = "" };

        var result = _sut.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "FileName");
    }

    [Fact]
    public void Should_Fail_When_FileName_Not_Xml()
    {
        var command = CreateValidCommand() with { FileName = "bank_statement.csv" };

        var result = _sut.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == "FileName" &&
            e.ErrorMessage.Contains("XML"));
    }

    [Fact]
    public void Should_Fail_When_UserName_Empty()
    {
        var command = CreateValidCommand() with { UserName = "" };

        var result = _sut.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "UserName");
    }
}
