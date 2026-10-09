<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_receive_a_token(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.name', 'Ada Lovelace')
            ->assertJsonPath('user.email', 'ada@example.com')
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

        $this->assertDatabaseHas('users', ['email' => 'ada@example.com']);
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_user_can_login_use_a_protected_route_and_logout(): void
    {
        User::factory()->create([
            'email' => 'user@example.com',
            'password' => 'password123',
        ]);

        $login = $this->postJson('/api/login', [
            'email' => 'user@example.com',
            'password' => 'password123',
        ])->assertOk();

        $token = $login->json('token');

        $this->withToken($token)
            ->getJson('/api/dashboard/summary')
            ->assertOk();

        $this->withToken($token)
            ->postJson('/api/logout')
            ->assertNoContent();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_invalid_credentials_and_missing_tokens_are_rejected(): void
    {
        User::factory()->create([
            'email' => 'user@example.com',
            'password' => 'correct-password',
        ]);

        $this->postJson('/api/login', [
            'email' => 'user@example.com',
            'password' => 'wrong-password',
        ])->assertUnauthorized();

        foreach (['/api/transactions', '/api/dashboard/summary'] as $uri) {
            $this->getJson($uri)
                ->assertUnauthorized()
                ->assertHeader('Content-Type', 'application/json')
                ->assertExactJson(['message' => 'Unauthenticated.']);
        }
    }

    public function test_protected_api_routes_return_json_401_without_accept_header(): void
    {
        config(['app.debug' => false]);

        foreach (['/api/transactions', '/api/dashboard/summary'] as $uri) {
            $this->get($uri)
                ->assertUnauthorized()
                ->assertHeader('Content-Type', 'application/json')
                ->assertExactJson(['message' => 'Unauthenticated.']);
        }
    }

    public function test_invalid_bearer_tokens_return_json_401_with_and_without_accept_header(): void
    {
        foreach (['/api/transactions', '/api/dashboard/summary'] as $uri) {
            foreach ([[], ['Accept' => 'application/json']] as $headers) {
                $this->get($uri, ['Authorization' => 'Bearer invalid-token'] + $headers)
                    ->assertUnauthorized()
                    ->assertHeader('Content-Type', 'application/json')
                    ->assertExactJson(['message' => 'Unauthenticated.']);
            }
        }
    }

    public function test_registration_validates_required_fields_and_unique_email(): void
    {
        User::factory()->create(['email' => 'existing@example.com']);

        $this->postJson('/api/register', [
            'name' => '',
            'email' => 'existing@example.com',
            'password' => 'short',
            'password_confirmation' => 'different',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password']);
    }
}
