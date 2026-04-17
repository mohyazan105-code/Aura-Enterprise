import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_DIR = os.path.join(BASE_DIR, 'database')
SECRET_KEY = 'aura-enterprise-secret-2025-xK9mP2vL'

# ─── Domains ──────────────────────────────────────────────────────────────────
DOMAINS = {
    'banking': {
        'name': 'Banking',
        'icon': '🏦',
        'color': '#00d2ff',
        'accent': '#008ba8',
        'gradient': 'linear-gradient(135deg, #00d2ff 0%, #008ba8 100%)',
        'description': 'Full-spectrum banking operations, compliance & financial intelligence',
        'db': os.path.join(DATABASE_DIR, 'banking.db')
    },
    'healthcare': {
        'name': 'Healthcare',
        'icon': '🏥',
        'color': '#c920d2',
        'accent': '#8a108f',
        'gradient': 'linear-gradient(135deg, #c920d2 0%, #8a108f 100%)',
        'description': 'Patient management, clinical operations & medical intelligence',
        'db': os.path.join(DATABASE_DIR, 'healthcare.db')
    },
    'education': {
        'name': 'Education',
        'icon': '🎓',
        'color': '#39ff14',
        'accent': '#20a80b',
        'gradient': 'linear-gradient(135deg, #39ff14 0%, #20a80b 100%)',
        'description': 'Academic administration, student lifecycle & learning analytics',
        'db': os.path.join(DATABASE_DIR, 'education.db')
    },
    'manufacturing': {
        'name': 'Manufacturing',
        'icon': '🏭',
        'color': '#f7931e',
        'accent': '#b86b11',
        'gradient': 'linear-gradient(135deg, #f7931e 0%, #b86b11 100%)',
        'description': 'Production control, supply chain & industrial intelligence',
        'db': os.path.join(DATABASE_DIR, 'manufacturing.db')
    }
}

# ─── Departments ──────────────────────────────────────────────────────────────
DEPARTMENTS = {
    'hr': {
        'name': 'Human Resources',
        'icon': '👥',
        'short': 'HR',
        'color': '#e53935',
        'entities': ['employees', 'contracts', 'leaves', 'payroll', 'performance']
    },
    'finance': {
        'name': 'Finance & Accounting',
        'icon': '💰',
        'short': 'Finance',
        'color': '#43a047',
        'entities': ['invoices', 'budgets', 'expenses', 'transactions', 'accounts']
    },
    'operations': {
        'name': 'Operations Management',
        'icon': '⚙️',
        'short': 'Operations',
        'color': '#1e88e5',
        'entities': ['tasks', 'resources', 'incidents', 'kpis', 'schedules']
    },
    'crm': {
        'name': 'Customer Relations',
        'icon': '🤝',
        'short': 'CRM',
        'color': '#fb8c00',
        'entities': ['customers', 'cases', 'interactions', 'leads', 'contracts']
    },
    'marketing': {
        'name': 'Marketing',
        'icon': '📈',
        'short': 'Marketing',
        'color': '#8e24aa',
        'entities': ['deals', 'campaigns', 'targets', 'funnel', 'prospects']
    },
    'pm': {
        'name': 'Project Management',
        'icon': '📋',
        'short': 'PM',
        'color': '#00897b',
        'entities': ['projects', 'milestones', 'teams', 'risks', 'deliverables']
    },
    'analytics': {
        'name': 'Analytics & Reporting',
        'icon': '📊',
        'short': 'Analytics',
        'color': '#5c6bc0',
        'entities': ['reports', 'metrics', 'dashboards', 'exports', 'insights']
    },
    'logistics': {
        'name': 'Logistics',
        'icon': '📦',
        'short': 'Logistics',
        'color': '#795548',
        'entities': ['inventory', 'shipments', 'tracking', 'suppliers', 'storage']
    },
    'academics': {
        'name': 'Academic Affairs',
        'icon': '📚',
        'short': 'Academics',
        'color': '#ffb300',
        'entities': ['students', 'performance', 'courses', 'attendance']
    }
}

# ─── Department Sections ──────────────────────────────────────────────────────
DEPT_SECTIONS = [
    {'id': 'dashboard',   'name': 'Dashboard',       'icon': '🏠'},
    {'id': 'data',        'name': 'Data Management',  'icon': '🗄️'},
    {'id': 'operations',  'name': 'Operations',       'icon': '⚡'},
    {'id': 'reports',     'name': 'Reports',          'icon': '📊'},
    {'id': 'workflows',   'name': 'Workflows',        'icon': '🔄'},
    {'id': 'settings',    'name': 'Settings',         'icon': '⚙️'},
    {'id': 'ai',          'name': 'AI Assistant',     'icon': '🤖'},
]

# ─── Roles & Permissions ──────────────────────────────────────────────────────
ROLES = {
    'admin': {
        'label': 'Administrator',
        'level': 4,
        'color': '#e53935',
        'can_create': True,
        'can_edit': True,
        'can_delete': True,
        'can_export': True,
        'can_manage_users': True,
        'analytics_scope': 'full',
        'dept_access': list(DEPARTMENTS.keys())
    },
    'manager': {
        'label': 'Manager',
        'level': 3,
        'color': '#1e88e5',
        'can_create': True,
        'can_edit': True,
        'can_delete': False,
        'can_export': True,
        'can_manage_users': False,
        'analytics_scope': 'department',
        'dept_access': list(DEPARTMENTS.keys())
    },
    'analyst': {
        'label': 'Analyst',
        'level': 2,
        'color': '#8e24aa',
        'can_create': False,
        'can_edit': False,
        'can_delete': False,
        'can_export': True,
        'can_manage_users': False,
        'analytics_scope': 'detailed',
        'dept_access': ['analytics', 'finance', 'sales', 'hr', 'academics']
    },
    'operator': {
        'label': 'Operator',
        'level': 1,
        'color': '#fb8c00',
        'can_create': True,
        'can_edit': True,
        'can_delete': False,
        'can_export': False,
        'can_manage_users': False,
        'analytics_scope': 'limited',
        'dept_access': ['operations', 'crm', 'pm']
    }
}

# ─── Default Users ────────────────────────────────────────────────────────────
DEFAULT_USERS = [
    {'username': 'admin@aura.com', 'password': 'pass123', 'role': 'admin', 'name': 'System Admin', 'department': 'operations'},
    {'username': 'hr@aura.com', 'password': 'pass123', 'role': 'manager', 'name': 'HR Director', 'department': 'hr'},
    {'username': 'finance@aura.com', 'password': 'pass123', 'role': 'manager', 'name': 'Finance Lead', 'department': 'finance'},
    {'username': 'pm@aura.com', 'password': 'pass123', 'role': 'manager', 'name': 'Project Manager', 'department': 'pm'},
    {'username': 'marketing@aura.com', 'password': 'pass123', 'role': 'manager', 'name': 'Marketing Head', 'department': 'marketing'},
    {'username': 'operations@aura.com', 'password': 'pass123', 'role': 'manager', 'name': 'Operations Chief', 'department': 'operations'},
    {'username': 'logistics@aura.com', 'password': 'pass123', 'role': 'manager', 'name': 'Logistics Manager', 'department': 'logistics'},
]
# ─── Core Employee Data ────────────────────────────────────────────────────────
CORE_EMPLOYEE_DATA = {
    'banking': {
        'hr': [
            {"id": 1, "name": "Alice Johnson", "role": "HR Manager", "access_level": "Department"},
            {"id": 2, "name": "Bob Smith", "role": "HR Analyst", "access_level": "Department"}
        ],
        'finance': [
            {"id": 3, "name": "Carol Lee", "role": "Finance Manager", "access_level": "Department"},
            {"id": 4, "name": "David Kim", "role": "Accountant", "access_level": "Department"}
        ],
        'pm': [
            {"id": 5, "name": "Eve Torres", "role": "PM Lead", "access_level": "Project"},
            {"id": 6, "name": "Frank Wilson", "role": "PM Coordinator", "access_level": "Project"}
        ],
        'marketing': [
            {"id": 7, "name": "Grace Hall", "role": "Marketing Manager", "access_level": "Department"},
            {"id": 8, "name": "Henry Adams", "role": "Marketing Specialist", "access_level": "Department"}
        ],
        'logistics': [
            {"id": 9, "name": "Irene Chen", "role": "Logistics Manager", "access_level": "Department"},
            {"id": 10, "name": "Jack Miller", "role": "Logistics Coordinator", "access_level": "Department"}
        ]
    },
    'healthcare': {
        'hr': [
            {"id": 11, "name": "Laura Green", "role": "HR Manager", "access_level": "Department"},
            {"id": 12, "name": "Mark White", "role": "HR Analyst", "access_level": "Department"}
        ],
        'finance': [
            {"id": 13, "name": "Nina Brown", "role": "Finance Manager", "access_level": "Department"},
            {"id": 14, "name": "Oscar King", "role": "Accountant", "access_level": "Department"}
        ],
        'pm': [
            {"id": 15, "name": "Paula Scott", "role": "PM Lead", "access_level": "Project"},
            {"id": 16, "name": "Quinn Lewis", "role": "PM Coordinator", "access_level": "Project"}
        ],
        'marketing': [
            {"id": 17, "name": "Rachel Young", "role": "Marketing Manager", "access_level": "Department"},
            {"id": 18, "name": "Sam Carter", "role": "Marketing Specialist", "access_level": "Department"}
        ],
        'logistics': [
            {"id": 19, "name": "Tina Rivera", "role": "Logistics Manager", "access_level": "Department"},
            {"id": 20, "name": "Ulysses Hall", "role": "Logistics Coordinator", "access_level": "Department"}
        ]
    },
    'education': {
        'hr': [
            {"id": 21, "name": "Victoria Allen", "role": "HR Manager", "access_level": "Department"},
            {"id": 22, "name": "William Brooks", "role": "HR Analyst", "access_level": "Department"}
        ],
        'finance': [
            {"id": 23, "name": "Xavier Foster", "role": "Finance Manager", "access_level": "Department"},
            {"id": 24, "name": "Yvonne Hayes", "role": "Accountant", "access_level": "Department"}
        ],
        'pm': [
            {"id": 25, "name": "Zachary Reed", "role": "PM Lead", "access_level": "Project"},
            {"id": 26, "name": "Amy Clark", "role": "PM Coordinator", "access_level": "Project"}
        ],
        'academics': [
            {"id": 101, "name": "Dr. Sarah Miller", "role": "Academic Dean", "access_level": "Department"},
            {"id": 102, "name": "Robert Brown", "role": "Student Advisor", "access_level": "Department"}
        ],
        'marketing': [
            {"id": 27, "name": "Brian Evans", "role": "Marketing Manager", "access_level": "Department"},
            {"id": 28, "name": "Cynthia Flores", "role": "Marketing Specialist", "access_level": "Department"}
        ],
        'logistics': [
            {"id": 29, "name": "Derek Gray", "role": "Logistics Manager", "access_level": "Department"},
            {"id": 30, "name": "Ella Hughes", "role": "Logistics Coordinator", "access_level": "Department"}
        ]
    },
    'manufacturing': {
        'hr': [
            {"id": 31, "name": "Fiona James", "role": "HR Manager", "access_level": "Department"},
            {"id": 32, "name": "George Kelly", "role": "HR Analyst", "access_level": "Department"}
        ],
        'finance': [
            {"id": 33, "name": "Hannah Long", "role": "Finance Manager", "access_level": "Department"},
            {"id": 34, "name": "Ian Moore", "role": "Accountant", "access_level": "Department"}
        ],
        'pm': [
            {"id": 35, "name": "Jackie Nelson", "role": "PM Lead", "access_level": "Project"},
            {"id": 36, "name": "Kevin Ortiz", "role": "PM Coordinator", "access_level": "Project"}
        ],
        'marketing': [
            {"id": 37, "name": "Linda Perez", "role": "Marketing Manager", "access_level": "Department"},
            {"id": 38, "name": "Michael Quinn", "role": "Marketing Specialist", "access_level": "Department"}
        ],
        'logistics': [
            {"id": 39, "name": "Nora Roberts", "role": "Logistics Manager", "access_level": "Department"},
            {"id": 40, "name": "Oliver Stone", "role": "Logistics Coordinator", "access_level": "Department"}
        ]
    }
}
