"use client";

import { useState } from "react";
import {
  UserCog,
  Search,
  Plus,
  Pencil,
  UserMinus,
  Shield,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

type UserRole = "admin" | "manager" | "agent" | "viewer";
type UserStatus = "active" | "inactive";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastActive: string;
  avatar: string;
}

const mockUsers: AppUser[] = [
  {
    id: "usr-000",
    name: "Manny Garcia",
    email: "manny.garcia@travelwifi.com",
    role: "admin",
    status: "active",
    lastActive: "2026-04-13 10:00",
    avatar: "MA",
  },
  {
    id: "usr-001",
    name: "Maria Garcia",
    email: "maria.g@travelwifi.com",
    role: "admin",
    status: "active",
    lastActive: "2026-04-09 09:15",
    avatar: "MR",
  },
  {
    id: "usr-002",
    name: "Carlos Rodriguez",
    email: "carlos.r@travelwifi.com",
    role: "manager",
    status: "active",
    lastActive: "2026-04-09 08:45",
    avatar: "CR",
  },
  {
    id: "usr-003",
    name: "Sarah Kim",
    email: "sarah.k@travelwifi.com",
    role: "agent",
    status: "active",
    lastActive: "2026-04-09 10:02",
    avatar: "SK",
  },
  {
    id: "usr-004",
    name: "James Chen",
    email: "james.c@travelwifi.com",
    role: "agent",
    status: "active",
    lastActive: "2026-04-08 17:30",
    avatar: "JC",
  },
  {
    id: "usr-005",
    name: "Emma Wilson",
    email: "emma.w@travelwifi.com",
    role: "agent",
    status: "inactive",
    lastActive: "2026-03-15 11:20",
    avatar: "EW",
  },
  {
    id: "usr-006",
    name: "David Park",
    email: "david.p@travelwifi.com",
    role: "viewer",
    status: "active",
    lastActive: "2026-04-07 14:10",
    avatar: "DP",
  },
  {
    id: "usr-007",
    name: "Lisa Tanaka",
    email: "lisa.t@travelwifi.com",
    role: "manager",
    status: "inactive",
    lastActive: "2026-02-28 09:00",
    avatar: "LT",
  },
];

const roleColors: Record<UserRole, string> = {
  admin: "bg-lavender/20 text-amethyst",
  manager: "bg-fraud-yellow-soft text-fraud-yellow",
  agent: "bg-success-soft text-success",
  viewer: "bg-muted text-muted-foreground",
};

const roleBadgeIcons: Record<UserRole, React.ElementType> = {
  admin: Shield,
  manager: UserCog,
  agent: CheckCircle,
  viewer: Clock,
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const filtered = mockUsers.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.includes(search.toLowerCase())
  );

  const stats = {
    total: mockUsers.length,
    active: mockUsers.filter((u) => u.status === "active").length,
    admins: mockUsers.filter((u) => u.role === "admin").length,
    agents: mockUsers.filter((u) => u.role === "agent").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-[540] text-charcoal">
            User Management
          </h1>
          <p className="mt-1 text-[14px] font-[460] text-muted-foreground">
            Manage team members, roles, and permissions
          </p>
        </div>
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogTrigger
            render={
              <Button className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]">
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Invite a new team member to TravelWifi Ops.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Full Name
                </label>
                <Input
                  placeholder="e.g. Jane Doe"
                  className="mt-1.5 rounded-[8px]"
                />
              </div>
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Email
                </label>
                <Input
                  placeholder="e.g. jane.d@travelwifi.com"
                  type="email"
                  className="mt-1.5 rounded-[8px]"
                />
              </div>
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Role
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["admin", "manager", "agent", "viewer"] as UserRole[]).map(
                    (role) => {
                      const Icon = roleBadgeIcons[role];
                      return (
                        <button
                          key={role}
                          className="flex items-center gap-2 rounded-[8px] border border-border px-3 py-2 text-[13px] font-[540] text-charcoal transition-colors hover:bg-muted cursor-pointer"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-[8px]"
                onClick={() => setShowAddUser(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]"
                onClick={() => setShowAddUser(false)}
              >
                <Mail className="h-4 w-4" />
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total Users",
            value: stats.total,
            icon: UserCog,
            bg: "bg-lavender/20",
            color: "text-amethyst",
          },
          {
            label: "Active",
            value: stats.active,
            icon: CheckCircle,
            bg: "bg-success-soft",
            color: "text-success",
          },
          {
            label: "Admins",
            value: stats.admins,
            icon: Shield,
            bg: "bg-fraud-yellow-soft",
            color: "text-fraud-yellow",
          },
          {
            label: "Agents",
            value: stats.agents,
            icon: UserCog,
            bg: "bg-cream",
            color: "text-charcoal",
          },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-[16px]">
            <CardContent className="flex items-center gap-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-[8px] ${stat.bg}`}
              >
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[12px] font-[460] text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-[20px] font-[600] text-charcoal">
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users by name, email, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-[8px]"
        />
      </div>

      {/* Users Table */}
      <Card className="rounded-[16px]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender/20 text-[12px] font-[600] text-amethyst">
                        {user.avatar}
                      </div>
                      <span className="text-[13px] font-[540] text-charcoal">
                        {user.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] font-[460] text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-[600] ${
                        roleColors[user.role]
                      }`}
                    >
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 text-[12px] font-[540] ${
                        user.status === "active"
                          ? "text-success"
                          : "text-muted-foreground"
                      }`}
                    >
                      {user.status === "active" ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {user.status.charAt(0).toUpperCase() +
                        user.status.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-[12px] font-[460] text-muted-foreground">
                    {user.lastActive}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingUser(user)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-fraud-red hover:text-fraud-red"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UserCog className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-[14px] font-[540] text-muted-foreground">
            No users found
          </p>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        {editingUser && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update {editingUser.name}&apos;s details and permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Full Name
                </label>
                <Input
                  defaultValue={editingUser.name}
                  className="mt-1.5 rounded-[8px]"
                />
              </div>
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Email
                </label>
                <Input
                  defaultValue={editingUser.email}
                  type="email"
                  className="mt-1.5 rounded-[8px]"
                />
              </div>
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Role
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["admin", "manager", "agent", "viewer"] as UserRole[]).map(
                    (role) => {
                      const Icon = roleBadgeIcons[role];
                      const isSelected = editingUser.role === role;
                      return (
                        <button
                          key={role}
                          className={`flex items-center gap-2 rounded-[8px] border px-3 py-2 text-[13px] font-[540] transition-colors cursor-pointer ${
                            isSelected
                              ? "border-amethyst bg-lavender/10 text-amethyst"
                              : "border-border text-charcoal hover:bg-muted"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-[8px]"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </Button>
              <Button
                className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]"
                onClick={() => setEditingUser(null)}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
