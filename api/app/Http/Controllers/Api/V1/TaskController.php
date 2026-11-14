<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RescheduleTasksRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Services\TaskService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class TaskController extends Controller
{
    public function __construct(private TaskService $tasks) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $view = $request->validate(['view' => ['required', 'in:today,inbox']])['view'];
        $today = $request->user()->today()->toDateString();

        $query = Task::with('labels')->open();

        if ($view === 'today') {
            // Inclui as tarefas em atraso; a data de hoje é a do fuso do utilizador.
            $query->whereDate('due_date', '<=', $today)
                ->orderBy('due_date')
                ->orderByRaw('due_time asc nulls last')
                ->orderBy('priority')
                ->orderBy('position');
        } else {
            $query->whereNull('project_id')->whereNull('parent_task_id')->orderBy('position');
        }

        return TaskResource::collection($query->orderBy('created_at')->get())
            ->additional(['meta' => ['today' => $today]]);
    }

    public function store(StoreTaskRequest $request): JsonResponse
    {
        $task = $this->tasks->create($request->validated());

        return (new TaskResource($task))->response()->setStatusCode(201);
    }

    public function update(UpdateTaskRequest $request, Task $task): TaskResource
    {
        return new TaskResource($this->tasks->update($task, $request->validated())->load('labels'));
    }

    public function destroy(Task $task): Response
    {
        $this->tasks->delete($task);

        return response()->noContent();
    }

    public function restore(Task $task): TaskResource
    {
        return new TaskResource($this->tasks->restore($task));
    }

    public function reschedule(RescheduleTasksRequest $request): AnonymousResourceCollection
    {
        return TaskResource::collection(
            $this->tasks->reschedule($request->validated('task_ids'), $request->validated('due_date'))
        );
    }
}
