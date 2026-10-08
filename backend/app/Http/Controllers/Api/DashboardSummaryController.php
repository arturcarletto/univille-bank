<?php

namespace App\Http\Controllers\Api;

use App\Domain\Transactions\TransactionStatus;
use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;

class DashboardSummaryController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $counts = Transaction::query()
            ->whereIn('status', [
                TransactionStatus::Pending->value,
                TransactionStatus::Processed->value,
            ])
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return response()->json([
            'pending' => (int) ($counts[TransactionStatus::Pending->value] ?? 0),
            'processed' => (int) ($counts[TransactionStatus::Processed->value] ?? 0),
        ]);
    }
}
