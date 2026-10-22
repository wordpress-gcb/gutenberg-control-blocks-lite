<?php
/**
 * A number control's `decimals` is a count (2026-10-23, the Airbnb rating summary): the builder writes it off the
 * design's sample and the render hands it to gcblite_number(). A count that is not a whole number of zero or more
 * is refused here, where block.fields.json is accepted or not, rather than printing something surprising later.
 *
 * @covers \GCBLite\Validation\BlockGcbValidator
 */

namespace GCBLite\Tests\Unit;

use GCBLite\Validation\BlockGcbValidator;
use PHPUnit\Framework\TestCase;

final class BlockGcbValidatorNumberTest extends TestCase
{
    private function errors(array $control): array
    {
        $control += ['id' => 'ctrl_score', 'type' => 'number', 'label' => 'Score', 'attributeKey' => 'score'];
        return array_column(BlockGcbValidator::validate(['controls' => [$control]])['errors'], 'message', 'path');
    }

    public function test_a_whole_count_of_decimals_is_accepted(): void
    {
        $this->assertSame([], $this->errors(['decimals' => 1, 'default' => 5.0]));
        $this->assertSame([], $this->errors(['decimals' => 0, 'default' => 14395]));
        $this->assertSame([], $this->errors(['decimals' => 2]));
        $this->assertSame([], $this->errors(['default' => 5]), 'no decimals: the value\'s own, nothing to check');
    }

    public function test_a_count_that_is_not_a_whole_number_of_zero_or_more_is_refused(): void
    {
        foreach ([-1, 1.5, 'two', '1', true, null] as $bad) {
            $errors = $this->errors(['decimals' => $bad]);
            $this->assertArrayHasKey('controls[0].decimals', $errors, var_export($bad, true));
            $this->assertStringContainsString('whole number', $errors['controls[0].decimals']);
        }
    }

    public function test_decimals_belong_to_number_fields_only(): void
    {
        $errors = $this->errors(['type' => 'text', 'decimals' => 1]);
        $this->assertArrayHasKey('controls[0].decimals', $errors);
        $this->assertSame([], $this->errors(['type' => 'range', 'decimals' => 1]), 'a range stores a number too');
    }
}
