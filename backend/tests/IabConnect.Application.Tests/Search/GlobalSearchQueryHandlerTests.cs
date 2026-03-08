using FluentAssertions;
using IabConnect.Application.Search;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Search;

/// <summary>
/// REQ-052: Unit tests for GlobalSearchQueryHandler
/// </summary>
public class GlobalSearchQueryHandlerTests
{
    private readonly Mock<IGlobalSearchService> _searchService = new();
    private readonly GlobalSearchQueryHandler _sut;

    public GlobalSearchQueryHandlerTests()
    {
        _sut = new GlobalSearchQueryHandler(_searchService.Object);
    }

    [Fact]
    public async Task Handle_EmptyQuery_ReturnsEmptyResult()
    {
        var query = new GlobalSearchQuery { Query = "" };

        var result = await _sut.Handle(query, CancellationToken.None);

        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
        _searchService.Verify(s => s.SearchAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_SingleCharQuery_ReturnsEmptyResult()
    {
        var query = new GlobalSearchQuery { Query = "a" };

        var result = await _sut.Handle(query, CancellationToken.None);

        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_WhitespaceQuery_ReturnsEmptyResult()
    {
        var query = new GlobalSearchQuery { Query = "   " };

        var result = await _sut.Handle(query, CancellationToken.None);

        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ValidQuery_DelegatesToSearchService()
    {
        var expectedResult = new GlobalSearchResult
        {
            Items = new List<SearchResultItem>
            {
                new()
                {
                    Scope = "members",
                    Id = Guid.NewGuid(),
                    Title = "Max Muster",
                    Subtitle = "max@test.ch",
                    Relevance = 0.9
                }
            },
            TotalCount = 1,
            Page = 1,
            PageSize = 20,
            CountsByScope = new Dictionary<string, int> { ["members"] = 1 }
        };

        _searchService
            .Setup(s => s.SearchAsync("max", "all", 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResult);

        var query = new GlobalSearchQuery { Query = "max", Scope = "all", Page = 1, PageSize = 20 };

        var result = await _sut.Handle(query, CancellationToken.None);

        result.Should().BeSameAs(expectedResult);
        _searchService.Verify(s => s.SearchAsync("max", "all", 1, 20, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_QueryWithLeadingTrailingSpaces_TrimsBeforeDelegating()
    {
        _searchService
            .Setup(s => s.SearchAsync("test", "all", 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GlobalSearchResult
            {
                Items = [],
                TotalCount = 0,
                Page = 1,
                PageSize = 20,
                CountsByScope = new Dictionary<string, int>()
            });

        var query = new GlobalSearchQuery { Query = "  test  " };

        await _sut.Handle(query, CancellationToken.None);

        _searchService.Verify(s => s.SearchAsync("test", It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ScopedQuery_PassesScopeToService()
    {
        _searchService
            .Setup(s => s.SearchAsync("invoice", "invoices", 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GlobalSearchResult
            {
                Items = [],
                TotalCount = 0,
                Page = 1,
                PageSize = 20,
                CountsByScope = new Dictionary<string, int>()
            });

        var query = new GlobalSearchQuery { Query = "invoice", Scope = "invoices" };

        await _sut.Handle(query, CancellationToken.None);

        _searchService.Verify(s => s.SearchAsync("invoice", "invoices", 1, 20, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_PaginationParameters_ForwardedCorrectly()
    {
        _searchService
            .Setup(s => s.SearchAsync("test", "all", 3, 50, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GlobalSearchResult
            {
                Items = [],
                TotalCount = 0,
                Page = 3,
                PageSize = 50,
                CountsByScope = new Dictionary<string, int>()
            });

        var query = new GlobalSearchQuery { Query = "test", Page = 3, PageSize = 50 };

        var result = await _sut.Handle(query, CancellationToken.None);

        result.Page.Should().Be(3);
        result.PageSize.Should().Be(50);
    }
}
