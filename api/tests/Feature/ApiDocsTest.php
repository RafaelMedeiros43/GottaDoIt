<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiDocsTest extends TestCase
{
    /** Cada rota implementada tem de estar documentada, e marcada como implementada. */
    public function test_every_route_is_documented_as_implemented(): void
    {
        $docs = file_get_contents(base_path('../docs/api.md'));
        $checked = 0;

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1/')) {
                continue;
            }

            $path = preg_replace('/\{\w+\}/', '{id}', substr($route->uri(), strlen('api/v1')));

            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $heading = "### $method $path — Implementado";
                $this->assertStringContainsString($heading."\n", $docs, "Falta em docs/api.md: $heading");
                $checked++;
            }
        }

        $this->assertGreaterThanOrEqual(17, $checked);
    }

    public function test_documented_as_implemented_means_the_route_exists(): void
    {
        $docs = file_get_contents(base_path('../docs/api.md'));
        preg_match_all('/^### (GET|POST|PATCH|PUT|DELETE) (\S+) — Implementado$/m', $docs, $matches, PREG_SET_ORDER);

        $routes = collect(Route::getRoutes())->flatMap(fn ($route) => array_map(
            fn ($method) => $method.' /'.preg_replace('/\{\w+\}/', '{id}', $route->uri()), $route->methods()
        ));

        foreach ($matches as [, $method, $path]) {
            $this->assertContains("$method /api/v1$path", $routes);
        }
    }
}
