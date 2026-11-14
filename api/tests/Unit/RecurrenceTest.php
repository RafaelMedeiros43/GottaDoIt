<?php

namespace Tests\Unit;

use App\Support\Recurrence;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class RecurrenceTest extends TestCase
{
    public static function nextCases(): array
    {
        return [
            'diária' => ['FREQ=DAILY', '2026-11-14', '2026-11-14', '2026-11-15'],
            'a cada 2 dias' => ['FREQ=DAILY;INTERVAL=2', '2026-11-14', '2026-11-14', '2026-11-16'],
            'em atraso salta para hoje' => ['FREQ=DAILY', '2026-11-01', '2026-11-14', '2026-11-14'],
            'em atraso respeita o intervalo' => ['FREQ=DAILY;INTERVAL=3', '2026-11-01', '2026-11-14', '2026-11-16'],
            'semanal sem dia' => ['FREQ=WEEKLY', '2026-11-14', '2026-11-14', '2026-11-21'],
            'todas as segundas' => ['FREQ=WEEKLY;BYDAY=MO', '2026-11-16', '2026-11-16', '2026-11-23'],
            'segundas e quintas' => ['FREQ=WEEKLY;BYDAY=MO,TH', '2026-11-16', '2026-11-16', '2026-11-19'],
            'sexta de duas em duas semanas' => ['FREQ=WEEKLY;INTERVAL=2;BYDAY=FR', '2026-11-13', '2026-11-13', '2026-11-27'],
            'dia 1 de cada mês' => ['FREQ=MONTHLY;BYMONTHDAY=1', '2026-12-01', '2026-12-01', '2027-01-01'],
            'dia 31 em fevereiro cai no último dia' => ['FREQ=MONTHLY;BYMONTHDAY=31', '2027-01-31', '2027-01-31', '2027-02-28'],
            'dia 31 volta depois de fevereiro' => ['FREQ=MONTHLY;BYMONTHDAY=31', '2027-02-28', '2027-02-28', '2027-03-31'],
            'mensal sem dia usa o dia do vencimento' => ['FREQ=MONTHLY', '2026-11-14', '2026-11-14', '2026-12-14'],
            'mensal ainda neste mês' => ['FREQ=MONTHLY;BYMONTHDAY=20', '2026-11-14', '2026-11-14', '2026-11-20'],
            'anual em 29 de fevereiro' => ['FREQ=YEARLY', '2028-02-29', '2028-02-29', '2029-02-28'],
            'ordem das chaves é livre' => ['INTERVAL=2;FREQ=DAILY', '2026-11-14', '2026-11-14', '2026-11-16'],
        ];
    }

    #[DataProvider('nextCases')]
    public function test_next(string $rule, string $due, string $today, string $expected): void
    {
        $next = Recurrence::next($rule, CarbonImmutable::parse($due), CarbonImmutable::parse($today));

        $this->assertSame($expected, $next->toDateString());
    }

    public static function invalidRules(): array
    {
        return [
            [''], ['FREQ=HOURLY'], ['FREQ=DAILY;INTERVAL=0'], ['FREQ=DAILY;INTERVAL=x'], ['FREQ=DAILY;BYDAY=MO'],
            ['FREQ=WEEKLY;BYDAY=XX'], ['FREQ=DAILY;COUNT=3'], ['INTERVAL=2'], ['FREQ=MONTHLY;BYMONTHDAY=32'],
            ['FREQ=WEEKLY;BYMONTHDAY=1'], ['FREQ=DAILY;FREQ=WEEKLY'], ['daily'],
        ];
    }

    #[DataProvider('invalidRules')]
    public function test_invalid_rules_are_rejected(string $rule): void
    {
        $this->assertFalse(Recurrence::isValid($rule));
    }

    public function test_valid_rules_are_accepted(): void
    {
        foreach (['FREQ=DAILY', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR', 'FREQ=MONTHLY;BYMONTHDAY=31', 'FREQ=YEARLY'] as $rule) {
            $this->assertTrue(Recurrence::isValid($rule), $rule);
        }
    }

    public function test_next_throws_on_invalid_rule(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        Recurrence::next('FREQ=HOURLY', CarbonImmutable::parse('2026-11-14'), CarbonImmutable::parse('2026-11-14'));
    }

    public function test_anchor_fixes_the_day_of_bare_monthly_rules_only(): void
    {
        $due = CarbonImmutable::parse('2027-01-31');

        $this->assertSame('FREQ=MONTHLY;BYMONTHDAY=31', Recurrence::anchor('FREQ=MONTHLY', $due));
        $this->assertSame('FREQ=MONTHLY;BYMONTHDAY=1', Recurrence::anchor('FREQ=MONTHLY;BYMONTHDAY=1', $due));
        $this->assertSame('FREQ=DAILY', Recurrence::anchor('FREQ=DAILY', $due));
        $this->assertSame('FREQ=HOURLY', Recurrence::anchor('FREQ=HOURLY', $due));
    }
}
