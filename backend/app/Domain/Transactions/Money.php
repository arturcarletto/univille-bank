<?php

namespace App\Domain\Transactions;

use InvalidArgumentException;

final readonly class Money
{
    private function __construct(public int $cents) {}

    public static function fromDecimal(string $amount): self
    {
        if (! preg_match('/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/D', $amount, $matches)) {
            throw new InvalidArgumentException('The amount must be a decimal string with at most two fraction digits.');
        }

        $fraction = str_pad($matches[2] ?? '', 2, '0');
        $minorUnits = ltrim($matches[1].$fraction, '0');
        $minorUnits = $minorUnits === '' ? '0' : $minorUnits;
        $maximum = (string) PHP_INT_MAX;

        if (strlen($minorUnits) > strlen($maximum)
            || (strlen($minorUnits) === strlen($maximum) && strcmp($minorUnits, $maximum) > 0)) {
            throw new InvalidArgumentException('The amount exceeds the supported range.');
        }

        $cents = (int) $minorUnits;

        if ($cents <= 0) {
            throw new InvalidArgumentException('The amount must be greater than zero.');
        }

        return new self($cents);
    }

    public static function fromCents(int $cents): self
    {
        if ($cents < 0) {
            throw new InvalidArgumentException('Cents cannot be negative.');
        }

        return new self($cents);
    }

    public function toDecimal(): string
    {
        return intdiv($this->cents, 100).'.'.str_pad((string) ($this->cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
