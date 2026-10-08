<?php

use App\Http\Controllers\Api\AuthenticationController;
use App\Http\Controllers\Api\DashboardSummaryController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:10,1')->group(function (): void {
    Route::post('/register', [AuthenticationController::class, 'register']);
    Route::post('/login', [AuthenticationController::class, 'login']);
});

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/logout', [AuthenticationController::class, 'logout']);
    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::get('/dashboard/summary', DashboardSummaryController::class);
});
