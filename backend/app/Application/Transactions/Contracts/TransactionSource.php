<?php

namespace App\Application\Transactions\Contracts;

interface TransactionSource
{
    /** @return list<mixed> */
    public function read(string $path): array;
}
