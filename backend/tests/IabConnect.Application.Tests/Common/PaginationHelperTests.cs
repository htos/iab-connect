using FluentAssertions;
using IabConnect.Application.Common;
using Xunit;

namespace IabConnect.Application.Tests.Common;

/// <summary>
/// Unit tests for PaginationHelper (shared pagination infrastructure).
/// </summary>
public class PaginationHelperTests
{
    #region ParseSort

    [Fact]
    public void ParseSort_NullInput_ReturnsDefaults()
    {
        var (field, desc) = PaginationHelper.ParseSort(null);
        field.Should().Be("createdAt");
        desc.Should().BeTrue();
    }

    [Fact]
    public void ParseSort_EmptyInput_ReturnsDefaults()
    {
        var (field, desc) = PaginationHelper.ParseSort("  ");
        field.Should().Be("createdAt");
        desc.Should().BeTrue();
    }

    [Fact]
    public void ParseSort_CustomDefaults()
    {
        var (field, desc) = PaginationHelper.ParseSort(null, "name", false);
        field.Should().Be("name");
        desc.Should().BeFalse();
    }

    [Fact]
    public void ParseSort_AscendingSort()
    {
        var (field, desc) = PaginationHelper.ParseSort("name:asc");
        field.Should().Be("name");
        desc.Should().BeFalse();
    }

    [Fact]
    public void ParseSort_DescendingSort()
    {
        var (field, desc) = PaginationHelper.ParseSort("amount:desc");
        field.Should().Be("amount");
        desc.Should().BeTrue();
    }

    [Fact]
    public void ParseSort_FieldOnly_DefaultsToAscending()
    {
        var (field, desc) = PaginationHelper.ParseSort("name");
        field.Should().Be("name");
        desc.Should().BeFalse();
    }

    [Fact]
    public void ParseSort_CaseInsensitiveDirection()
    {
        var (field, desc) = PaginationHelper.ParseSort("date:DESC");
        field.Should().Be("date");
        desc.Should().BeTrue();
    }

    #endregion

    #region ParseFilter

    [Fact]
    public void ParseFilter_NullInput_ReturnsEmpty()
    {
        var result = PaginationHelper.ParseFilter(null);
        result.Should().BeEmpty();
    }

    [Fact]
    public void ParseFilter_EmptyInput_ReturnsEmpty()
    {
        var result = PaginationHelper.ParseFilter("  ");
        result.Should().BeEmpty();
    }

    [Fact]
    public void ParseFilter_SinglePair()
    {
        var result = PaginationHelper.ParseFilter("status=Active");
        result.Should().ContainKey("status").WhoseValue.Should().Be("Active");
    }

    [Fact]
    public void ParseFilter_MultiplePairs()
    {
        var result = PaginationHelper.ParseFilter("status=Active,direction=Incoming");
        result.Should().HaveCount(2);
        result["status"].Should().Be("Active");
        result["direction"].Should().Be("Incoming");
    }

    [Fact]
    public void ParseFilter_ValueWithEquals()
    {
        var result = PaginationHelper.ParseFilter("query=a=b");
        result["query"].Should().Be("a=b");
    }

    [Fact]
    public void ParseFilter_CaseInsensitiveKeys()
    {
        var result = PaginationHelper.ParseFilter("Status=Active");
        result.ContainsKey("status").Should().BeTrue();
        result.ContainsKey("STATUS").Should().BeTrue();
    }

    [Fact]
    public void ParseFilter_IgnoresEmptyKeys()
    {
        var result = PaginationHelper.ParseFilter("=value, =other");
        result.Should().BeEmpty();
    }

    #endregion

    #region ToPagedResult

    [Fact]
    public void ToPagedResult_FirstPage()
    {
        var items = Enumerable.Range(1, 50).ToList();
        var result = items.ToPagedResult(page: 1, pageSize: 10);

        result.Items.Should().HaveCount(10);
        result.Items.First().Should().Be(1);
        result.Items.Last().Should().Be(10);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
        result.TotalCount.Should().Be(50);
        result.TotalPages.Should().Be(5);
        result.HasNextPage.Should().BeTrue();
        result.HasPreviousPage.Should().BeFalse();
    }

    [Fact]
    public void ToPagedResult_MiddlePage()
    {
        var items = Enumerable.Range(1, 50).ToList();
        var result = items.ToPagedResult(page: 3, pageSize: 10);

        result.Items.Should().HaveCount(10);
        result.Items.First().Should().Be(21);
        result.Items.Last().Should().Be(30);
        result.Page.Should().Be(3);
        result.TotalPages.Should().Be(5);
        result.HasNextPage.Should().BeTrue();
        result.HasPreviousPage.Should().BeTrue();
    }

    [Fact]
    public void ToPagedResult_LastPage()
    {
        var items = Enumerable.Range(1, 50).ToList();
        var result = items.ToPagedResult(page: 5, pageSize: 10);

        result.Items.Should().HaveCount(10);
        result.Items.First().Should().Be(41);
        result.Items.Last().Should().Be(50);
        result.HasNextPage.Should().BeFalse();
        result.HasPreviousPage.Should().BeTrue();
    }

    [Fact]
    public void ToPagedResult_PartialLastPage()
    {
        var items = Enumerable.Range(1, 25).ToList();
        var result = items.ToPagedResult(page: 3, pageSize: 10);

        result.Items.Should().HaveCount(5);
        result.Items.First().Should().Be(21);
        result.TotalCount.Should().Be(25);
        result.TotalPages.Should().Be(3);
        result.HasNextPage.Should().BeFalse();
    }

    [Fact]
    public void ToPagedResult_BeyondLastPage_ReturnsEmpty()
    {
        var items = Enumerable.Range(1, 10).ToList();
        var result = items.ToPagedResult(page: 5, pageSize: 10);

        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(10);
        result.TotalPages.Should().Be(1);
    }

    [Fact]
    public void ToPagedResult_EmptySource()
    {
        var items = new List<int>();
        var result = items.ToPagedResult(page: 1, pageSize: 10);

        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
        result.TotalPages.Should().Be(0);
        result.HasNextPage.Should().BeFalse();
        result.HasPreviousPage.Should().BeFalse();
    }

    [Fact]
    public void ToPagedResult_ClampsPageMin()
    {
        var items = Enumerable.Range(1, 5).ToList();
        var result = items.ToPagedResult(page: -1, pageSize: 10);

        result.Page.Should().Be(1);
        result.Items.Should().HaveCount(5);
    }

    [Fact]
    public void ToPagedResult_ClampsPageSizeToUpperBound()
    {
        var items = Enumerable.Range(1, 200).ToList();
        var result = items.ToPagedResult(page: 1, pageSize: 500);

        result.PageSize.Should().Be(100);
        result.Items.Should().HaveCount(100);
    }

    [Fact]
    public void ToPagedResult_ClampsPageSizeToLowerBound()
    {
        var items = Enumerable.Range(1, 10).ToList();
        var result = items.ToPagedResult(page: 1, pageSize: 0);

        result.PageSize.Should().Be(1);
        result.Items.Should().HaveCount(1);
    }

    [Fact]
    public void ToPagedResult_DefaultParams()
    {
        var items = Enumerable.Range(1, 50).ToList();
        var result = items.ToPagedResult();

        result.Page.Should().Be(1);
        result.PageSize.Should().Be(20);
        result.Items.Should().HaveCount(20);
    }

    #endregion

    #region ApplySort

    [Fact]
    public void ApplySort_Ascending()
    {
        var items = new[] { 3, 1, 2 };
        var sorted = items.ApplySort(x => x, descending: false).ToList();

        sorted.Should().BeInAscendingOrder();
    }

    [Fact]
    public void ApplySort_Descending()
    {
        var items = new[] { 1, 3, 2 };
        var sorted = items.ApplySort(x => x, descending: true).ToList();

        sorted.Should().BeInDescendingOrder();
    }

    [Fact]
    public void ApplySort_WithStringProperty()
    {
        var items = new[] { "Charlie", "Alpha", "Bravo" };
        var sorted = items.ApplySort(x => x, descending: false).ToList();

        sorted.Should().Equal("Alpha", "Bravo", "Charlie");
    }

    #endregion

    #region PagedResult<T>

    [Fact]
    public void PagedResult_Empty_HasCorrectDefaults()
    {
        var result = PagedResult<string>.Empty(1, 20);

        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(20);
        result.TotalPages.Should().Be(0);
        result.HasNextPage.Should().BeFalse();
        result.HasPreviousPage.Should().BeFalse();
    }

    [Fact]
    public void PagedResult_TotalPages_RoundsUp()
    {
        var result = new PagedResult<int>
        {
            Items = [1, 2, 3],
            TotalCount = 7,
            Page = 1,
            PageSize = 3
        };

        result.TotalPages.Should().Be(3);
    }

    #endregion
}
