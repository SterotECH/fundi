from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core import services


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payload = services.get_dashboard_summary(
            organisation=request.user.organisation,
        )
        return Response(payload)
