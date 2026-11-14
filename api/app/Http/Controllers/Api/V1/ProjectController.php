<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProjectController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ProjectResource::collection(Project::orderBy('position')->orderBy('created_at')->get());
    }

    public function store(StoreProjectRequest $request): JsonResponse
    {
        $project = Project::create($request->validated() + [
            'position' => (Project::max('position') ?? 0) + 1,
        ]);

        return (new ProjectResource($project))->response()->setStatusCode(201);
    }
}
