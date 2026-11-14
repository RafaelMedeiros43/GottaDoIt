<?php

namespace App\Http\Requests;

use App\Models\Task;

class UpdateTaskRequest extends TaskRequest
{
    protected function task(): ?Task
    {
        return $this->route('task');
    }

    protected function titlePresence(): string
    {
        return 'sometimes';
    }
}
