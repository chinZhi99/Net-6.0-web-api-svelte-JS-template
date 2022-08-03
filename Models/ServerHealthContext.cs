using Microsoft.EntityFrameworkCore;
using System.Diagnostics.CodeAnalysis;

namespace ServerHealthApi.Models
{
    public class ServerHealthContext : DbContext
    {
        public ServerHealthContext(DbContextOptions<ServerHealthContext> options)
            : base(options)
        {
        }

        public DbSet<ServerHealth> ServersHealth { get; set; } = null!;
    }
}