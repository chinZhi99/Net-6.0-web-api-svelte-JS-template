<script>
  	import configStore from "./stores/configStore.js";
	import Navbar from "./components/navbar.svelte";
	import ToDo from "./pages/todo.svelte";
import Todo from "./pages/todo.svelte";

	let config = null;
	configStore.subscribe((data) => {
		config = data;
	});
</script>

<Navbar>
	<li class="nav-item">
		<a class="nav-link active" aria-current="page" href="#">Test</a>
	</li>
	<li class="nav-item">
		<a class="nav-link" aria-current="page" href="#">Test2</a>
	</li>
</Navbar>

<Todo></Todo>


