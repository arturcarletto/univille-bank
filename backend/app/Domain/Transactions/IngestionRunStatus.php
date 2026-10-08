<?php

namespace App\Domain\Transactions;

enum IngestionRunStatus: string
{
    case Pending = 'pending';
    case Dispatched = 'dispatched';
    case Failed = 'failed';
}
