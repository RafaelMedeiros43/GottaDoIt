<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use InvalidArgumentException;

/**
 * Regras de recorrência num subconjunto de RRULE:
 *
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY   obrigatório
 *   INTERVAL=n                         n >= 1 (por omissão 1)
 *   BYDAY=MO,TU,WE,TH,FR,SA,SU         só com WEEKLY
 *   BYMONTHDAY=1..31                   só com MONTHLY
 */
class Recurrence
{
    private const DAYS = ['MO' => 1, 'TU' => 2, 'WE' => 3, 'TH' => 4, 'FR' => 5, 'SA' => 6, 'SU' => 7];

    /** Limite de segurança para tarefas muito atrasadas. */
    private const MAX_STEPS = 50000;

    public static function isValid(string $rule): bool
    {
        return self::parse($rule) !== null;
    }

    /**
     * Fixa o dia do mês numa regra mensal que não o diga ("todos os meses"
     * criada no dia 31 passa a BYMONTHDAY=31). Sem isto, depois de um mês
     * curto a tarefa ficava para sempre no dia 28.
     */
    public static function anchor(string $rule, CarbonImmutable $due): string
    {
        $parsed = self::parse($rule);

        if ($parsed === null || $parsed['freq'] !== 'MONTHLY' || $parsed['bymonthday'] !== null) {
            return $rule;
        }

        return $rule.';BYMONTHDAY='.$due->day;
    }

    /** A primeira ocorrência depois de `$due` que não seja anterior a `$today`. */
    public static function next(string $rule, CarbonImmutable $due, CarbonImmutable $today): CarbonImmutable
    {
        $parsed = self::parse($rule) ?? throw new InvalidArgumentException("Regra de recorrência inválida: $rule");

        $due = $due->startOfDay();
        $today = $today->startOfDay();

        foreach (self::occurrences($parsed, $due) as $candidate) {
            if ($candidate->gt($due) && $candidate->gte($today)) {
                return $candidate;
            }
        }

        throw new InvalidArgumentException("Não foi possível calcular a próxima ocorrência de: $rule");
    }

    /** @return iterable<CarbonImmutable> ocorrências por ordem crescente, a partir de `$due` */
    private static function occurrences(array $rule, CarbonImmutable $due): iterable
    {
        ['freq' => $freq, 'interval' => $interval, 'byday' => $byday, 'bymonthday' => $monthDay] = $rule;

        for ($k = 0; $k < self::MAX_STEPS; $k++) {
            switch ($freq) {
                case 'DAILY':
                    yield $due->addDays($k * $interval);
                    break;

                case 'WEEKLY':
                    if ($byday === []) {
                        yield $due->addWeeks($k * $interval);
                        break;
                    }
                    // Semanas (segunda a domingo) contadas a partir da semana do vencimento.
                    $monday = $due->startOfWeek(CarbonImmutable::MONDAY)->addWeeks($k * $interval);
                    foreach ($byday as $isoDay) {
                        yield $monday->addDays($isoDay - 1);
                    }
                    break;

                case 'MONTHLY':
                    $month = $due->startOfMonth()->addMonthsNoOverflow($k * $interval);
                    yield $month->day(min($monthDay ?? $due->day, $month->daysInMonth));
                    break;

                case 'YEARLY':
                    $month = $due->startOfMonth()->addYearsNoOverflow($k * $interval);
                    yield $month->day(min($due->day, $month->daysInMonth));
                    break;
            }
        }
    }

    /** @return array{freq: string, interval: int, byday: int[], bymonthday: ?int}|null */
    private static function parse(string $rule): ?array
    {
        $parts = [];

        foreach (explode(';', $rule) as $pair) {
            if (! preg_match('/^([A-Z]+)=([A-Z0-9,]+)$/', $pair, $m) || isset($parts[$m[1]])) {
                return null;
            }
            $parts[$m[1]] = $m[2];
        }

        if (array_diff(array_keys($parts), ['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY']) !== []) {
            return null;
        }

        $freq = $parts['FREQ'] ?? null;
        if (! in_array($freq, ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'], true)) {
            return null;
        }

        $interval = $parts['INTERVAL'] ?? '1';
        if (! ctype_digit($interval) || (int) $interval < 1 || (int) $interval > 999) {
            return null;
        }

        $byday = [];
        if (isset($parts['BYDAY'])) {
            if ($freq !== 'WEEKLY') {
                return null;
            }
            foreach (explode(',', $parts['BYDAY']) as $day) {
                if (! isset(self::DAYS[$day])) {
                    return null;
                }
                $byday[] = self::DAYS[$day];
            }
            $byday = array_values(array_unique($byday));
            sort($byday);
        }

        $monthDay = null;
        if (isset($parts['BYMONTHDAY'])) {
            $monthDay = $parts['BYMONTHDAY'];
            if ($freq !== 'MONTHLY' || ! ctype_digit($monthDay) || (int) $monthDay < 1 || (int) $monthDay > 31) {
                return null;
            }
            $monthDay = (int) $monthDay;
        }

        return ['freq' => $freq, 'interval' => (int) $interval, 'byday' => $byday, 'bymonthday' => $monthDay];
    }
}
