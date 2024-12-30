export type TodoRecord = [
  id: string,
  text: string,
  completed: 0 | 1,
  created_at: number,
  updated_at: number,
  deleted_at: number | null
];

export type TodoAction =
  | {
      type: "create";
      payload: {
        id: string;
        text: string;
        completed: 0 | 1;
      };
    }
  | {
      type: "update";
      payload: {
        id: string;
        text: string;
        completed: 0 | 1;
      };
    }
  | {
      type: "delete";
      payload: {
        id: string;
      };
    };
