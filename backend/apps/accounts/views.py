# apps/accounts/views.py
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from apps.accounts.serializers import LoginSerializer, UserSerializer, UpdateMeSerializer
from apps.accounts import services


class LoginView(APIView):
    permission_classes = [AllowAny]  # override the global IsAuthenticated default

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, access_token, refresh_token = services.login_user(
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )

        if not user:
            return Response(
                {'detail': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        response = Response({
            'access': access_token,
            'user': UserSerializer(user).data,
        })

        # Set refresh token as HttpOnly cookie — Decision 04
        response.set_cookie(
            key='refresh_token',
            value=refresh_token,
            httponly=True,
            secure=False,       # True in production
            samesite='Lax',
            max_age=7 * 24 * 60 * 60,  # 7 days in seconds
        )
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token')
        # Read from cookie, not request body — this is the security model

        if not refresh_token:
            return Response(
                {'detail': 'No refresh token provided.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            token = RefreshToken(refresh_token)
            access_token = str(token.access_token)
        except TokenError:
            return Response(
                {'detail': 'Invalid or expired refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        return Response({'access': access_token})


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            services.logout_user(refresh_token)

        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie('refresh_token')
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UpdateMeSerializer(
            request.user,
            data=request.data,
            partial=True,   # partial=True allows updating only some fields
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)
