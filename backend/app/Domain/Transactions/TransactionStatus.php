<?php

namespace App\Domain\Transactions;

enum TransactionStatus: string
{
    case Pending = 'pending';
    case Processed = 'processed';
    case Invalid = 'invalid';
    case Failed = 'failed';
}
