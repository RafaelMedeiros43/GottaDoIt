<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Services\TaskService;
use Illuminate\Http\Request;

class TaskCompletionController extends Controller
{
    public function __construct(private TaskService $tasks) {}

    public function complete(Request $request, Task $task): TaskResource
    {
        $recurred = $this->tasks->complete($task, $request->user()->today());

        return (new TaskResource($task->load('labels')))->additional(['meta' => ['recurred' => $recurred]]);
    }

    public function reopen(Task $task): TaskResource
    {
        $this->tasks->reopen($task);

        return new TaskResource($task->load('labels'));
    }
}
