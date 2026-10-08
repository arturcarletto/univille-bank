<?php

namespace Tests\Unit;

use App\Domain\Transactions\Money;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    #[DataProvider('validAmounts')]
    public function test_it_converts_decimal_strings_without_floating_point(
        string $decimal,
        int $cents,
        string $normalized,
    ): void {
        $money = Money::fromDecimal($decimal);

        $this->assertSame($cents, $money->cents);
        $this->assertSame($normalized, $money->toDecimal());
    }

    /** @return array<string, array{string, int, string}> */
    public static function validAmounts(): array
    {
        return [
            'whole' => ['12', 1200, '12.00'],
            'one decimal digit' => ['12.3', 1230, '12.30'],
            'two decimal digits' => ['12.34', 1234, '12.34'],
            'smallest positive unit' => ['0.01', 1, '0.01'],
        ];
    }

    #[DataProvider('invalidAmounts')]
    public function test_it_rejects_ambiguous_or_unsupported_amounts(string $amount): void
    {
        $this->expectException(InvalidArgumentException::class);

        Money::fromDecimal($amount);
    }

    /** @return array<string, array{string}> */
    public static function invalidAmounts(): array
    {
        return [
            'zero' => ['0.00'],
            'negative' => ['-1.00'],
            'too many fraction digits' => ['1.001'],
            'comma' => ['1,00'],
            'scientific notation' => ['1e3'],
            'overflow' => ['999999999999999999999999.99'],
        ];
    }
}
