using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServerHealthApi.Models;

namespace dotnet_svelte.Controllers
{
    [Route("api/ServersHealth")]
    [ApiController]
    public class ServersHealthController : ControllerBase
    {
        private readonly ServerHealthContext _context;

        public ServersHealthController(ServerHealthContext context)
        {
            _context = context;
        }

        // GET: api/ServersHealth
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ServerHealth>>> GetServersHealth()
        {
          if (_context.ServersHealth == null)
          {
              return NotFound();
          }
            return await _context.ServersHealth.ToListAsync();
        }

        // GET: api/ServersHealth/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ServerHealth>> GetServerHealth(long id)
        {
          if (_context.ServersHealth == null)
          {
              return NotFound();
          }
            var serverHealth = await _context.ServersHealth.FindAsync(id);

            if (serverHealth == null)
            {
                return NotFound();
            }

            return serverHealth;
        }

        // PUT: api/ServersHealth/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutServerHealth(long id, ServerHealth serverHealth)
        {
            if (id != serverHealth.Id)
            {
                return BadRequest();
            }

            _context.Entry(serverHealth).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ServerHealthExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/ServersHealth
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<ServerHealth>> PostServerHealth(ServerHealth serverHealth)
        {
            _context.ServersHealth.Add(serverHealth);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetServerHealth), new { id = serverHealth.Id }, serverHealth);
        }

        // DELETE: api/ServersHealth/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteServerHealth(long id)
        {
            if (_context.ServersHealth == null)
            {
                return NotFound();
            }
            var serverHealth = await _context.ServersHealth.FindAsync(id);
            if (serverHealth == null)
            {
                return NotFound();
            }

            _context.ServersHealth.Remove(serverHealth);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ServerHealthExists(long id)
        {
            return (_context.ServersHealth?.Any(e => e.Id == id)).GetValueOrDefault();
        }
    }
}
