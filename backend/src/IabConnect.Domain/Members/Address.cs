using IabConnect.Domain.Common;

namespace IabConnect.Domain.Members;

/// <summary>
/// Address value object
/// </summary>
public sealed class Address : ValueObject
{
    public string Street { get; }
    public string City { get; }
    public string PostalCode { get; }
    public string Country { get; }

    private Address(string street, string city, string postalCode, string country)
    {
        Street = street;
        City = city;
        PostalCode = postalCode;
        Country = country;
    }

    public static Address Create(string street, string city, string postalCode, string country)
    {
        if (string.IsNullOrWhiteSpace(street))
            throw new ArgumentException("Street is required", nameof(street));
        if (string.IsNullOrWhiteSpace(city))
            throw new ArgumentException("City is required", nameof(city));
        if (string.IsNullOrWhiteSpace(postalCode))
            throw new ArgumentException("Postal code is required", nameof(postalCode));
        if (string.IsNullOrWhiteSpace(country))
            throw new ArgumentException("Country is required", nameof(country));

        return new Address(street.Trim(), city.Trim(), postalCode.Trim(), country.Trim());
    }

    /// <summary>
    /// Creates an empty placeholder address for users without address data yet.
    /// </summary>
    public static Address CreateEmpty()
    {
        return new Address(
            street: "Nicht angegeben",
            city: "Nicht angegeben",
            postalCode: "0000",
            country: "Schweiz"
        );
    }

    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Street;
        yield return City;
        yield return PostalCode;
        yield return Country;
    }

    public override string ToString()
    {
        return $"{Street}, {PostalCode} {City}, {Country}";
    }
}
