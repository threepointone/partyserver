import "./styles.css";

import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useSync } from "partysync/react";

import type { TodoRecord, TodoRpc } from "../shared";

function App() {
  const [newTodo, setNewTodo] = useState("");
  const [todos, mutate] = useSync<TodoRecord, TodoRpc>(
    "todos",
    (todos, request): TodoRecord[] => {
      switch (request.type) {
        case "create": {
          const { id, text, completed } = request.payload;
          return [
            ...todos,
            [id, text, completed, Date.now(), Date.now(), null]
          ];
        }
        case "update": {
          const { id, text, completed } = request.payload;
          return todos.map((todo) =>
            todo[0] === id
              ? [id, text, completed, todo[3], Date.now(), null]
              : todo
          );
        }
        case "delete":
          return todos.filter((todo) => todo[0] !== request.payload.id);
        default:
          console.error("unknown request", request);
          return todos;
      }
    }
  );

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodo.trim()) {
      setNewTodo("");
      mutate({
        type: "create",
        payload: {
          id: crypto.randomUUID(),
          text: newTodo.trim(),
          completed: 0
        }
      });
    }
  };

  const toggleTodo = (id: string) => {
    const todo = todos.find((todo) => todo[0] === id);
    if (!todo) return;
    mutate({
      type: "update",
      payload: {
        id,
        text: todo[1],
        completed: todo[2] === 0 ? 1 : 0
      }
    });
  };

  const deleteTodo = (id: string) => {
    const todo = todos.find((todo) => todo[0] === id);
    if (!todo) return;
    mutate({
      type: "delete",
      payload: { id }
    });
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <h1 className="text-2xl font-bold mb-4">Todo App</h1>

      <form onSubmit={addTodo} className="mb-4 flex gap-2">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a new todo"
          className="flex-1 px-3 py-2 border rounded"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {todos
          .filter((todo) => todo[5] === null)
          .map((todo) => (
            <li
              key={todo[0]}
              className="flex items-center gap-2 p-2 border rounded"
            >
              <input
                type="checkbox"
                checked={todo[2] === 1}
                onChange={() => toggleTodo(todo[0])}
                className="h-5 w-5"
              />
              <span
                className={todo[2] === 1 ? "line-through flex-1" : "flex-1"}
              >
                {todo[1]}
              </span>
              <button
                type="button"
                onClick={() => deleteTodo(todo[0])}
                className="px-2 py-1 text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
