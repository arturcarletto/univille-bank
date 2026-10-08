<?php

namespace App\Infrastructure\Transactions\Sources;

use App\Application\Transactions\Contracts\TransactionSource;
use App\Application\Transactions\Exceptions\CorruptSourceException;
use App\Application\Transactions\Exceptions\SourceUnavailableException;
use JsonException;

final readonly class LocalJsonTransactionSource implements TransactionSource
{
    public function __construct(private string $fixtureDirectory) {}

    public function read(string $path): array
    {
        $root = realpath($this->fixtureDirectory);
        $candidate = $root === false ? false : realpath($root.DIRECTORY_SEPARATOR.$path);

        if ($root === false || $candidate === false || ! str_starts_with($candidate, $root.DIRECTORY_SEPARATOR)) {
            throw new SourceUnavailableException('The simulated transaction source is unavailable.');
        }

        $contents = file_get_contents($candidate);

        if ($contents === false) {
            throw new SourceUnavailableException('The simulated transaction source could not be read.');
        }

        try {
            $transactions = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new CorruptSourceException('The simulated transaction source contains invalid JSON.', previous: $exception);
        }

        if (! is_array($transactions) || ! array_is_list($transactions)) {
            throw new CorruptSourceException('The simulated transaction source must contain a JSON list.');
        }

        return $transactions;
    }
}
