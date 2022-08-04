<div class="row">
    <div class="col-1" />
    <div class="col-10 border border-secondary">
      <h1>Todo Test CRUD</h1>
      <h3>Add</h3>
      <form action="javascript:void(0);" method="POST" onsubmit="addItem()">
        <input type="text" id="add-name" placeholder="New to-do" />
        <input type="submit" value="Add" />
      </form>
  
      <div id="editForm" style="display:none;">
        <h3>Edit</h3>
        <form action="javascript:void(0);" onsubmit="updateItem()">
          <input type="hidden" id="edit-id" />
          <input type="checkbox" id="edit-isComplete" />
          <input type="text" id="edit-name" />
          <input type="submit" value="Save" />
          <a onclick="closeInput()" aria-label="Close">&#10006;</a>
        </form>
      </div>
  
      <p id="counter" />
  
      <table>
        <tr>
          <th>Is Complete?</th>
          <th>Name</th>
          <th />
          <th />
        </tr>
        <tbody id="todos" />
      </table>
    </div>
    <div class="col-1" />
  </div>
  
  <script type="text/javascript">
      getItems();
  </script>
  